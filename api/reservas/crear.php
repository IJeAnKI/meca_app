<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
requireMethod('POST');

try {
    $payload = jsonRequestBody();
    $sessionUser = authenticatedUser('ASESORADO');

    $idTutor = filter_var($payload['id_tutor'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $duracion = filter_var($payload['duracion_horas'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $materia = is_string($payload['materia'] ?? null) ? trim($payload['materia']) : '';
    $fechaTexto = is_string($payload['fecha_hora_inicio'] ?? null) ? $payload['fecha_hora_inicio'] : '';
    $fecha = DateTimeImmutable::createFromFormat('!Y-m-d\\TH:i', $fechaTexto);
    $erroresFecha = DateTimeImmutable::getLastErrors();
    if ($idTutor === false || $duracion === false || $materia === '' || strlen($materia) > 150 || !$fecha || ($erroresFecha !== false && ($erroresFecha['warning_count'] || $erroresFecha['error_count']))) {
        sendJson(422, false, 'Verifica id_tutor, materia, fecha_hora_inicio y duracion_horas.');
    }

    $roomUrl = $payload['room_token_url'] ?? null;
    if ($roomUrl !== null && (!is_string($roomUrl) || strlen($roomUrl) > 500 || filter_var($roomUrl, FILTER_VALIDATE_URL) === false)) {
        sendJson(422, false, 'room_token_url debe ser una URL válida de máximo 500 caracteres.');
    }

    $pdo = getDatabaseConnection();
    $pdo->beginTransaction();
    $tutor = $pdo->prepare("SELECT pt.precio_hora FROM perfil_tutor pt WHERE pt.id_tutor = :id AND pt.estado = 'ACTIVO'
        AND EXISTS (SELECT 1 FROM materia_tutor mt WHERE mt.id_tutor = pt.id_tutor AND LOWER(mt.nombre_materia) = LOWER(:materia))");
    $tutor->execute([':id' => $idTutor, ':materia' => $materia]);
    $precioHora = $tutor->fetchColumn();
    if ($precioHora === false) {
        $pdo->rollBack();
        sendJson(422, false, 'El tutor no está activo o no ofrece esa materia.');
    }

    // Los importes se calculan en el servidor: no se aceptan valores monetarios manipulables del cliente.
    $montoTotal = round((float) $precioHora * $duracion, 2);
    $comisionMeca = 15.00;
    $insertar = $pdo->prepare("INSERT INTO reserva
        (id_estudiante, id_tutor, materia, fecha_hora_inicio, duracion_horas, monto_total, comision_meca, pago_estado, estado_reserva, room_token_url)
        VALUES (:id_estudiante, :id_tutor, :materia, :fecha, :duracion, :monto, :comision, 'PENDIENTE', 'PROGRAMADA', :room_url)
        RETURNING id_reserva");
    $insertar->execute([
        ':id_estudiante' => $sessionUser['id_usuario'], ':id_tutor' => $idTutor, ':materia' => $materia,
        ':fecha' => $fecha->format('Y-m-d H:i:s'), ':duracion' => $duracion,
        ':monto' => $montoTotal, ':comision' => $comisionMeca, ':room_url' => $roomUrl,
    ]);
    $idReserva = (int) $insertar->fetchColumn();
    $pdo->commit();
    sendJson(201, true, 'Reserva creada correctamente', [
        'id_reserva' => $idReserva, 'monto_total' => $montoTotal, 'comision_meca' => $comisionMeca,
        'pago_estado' => 'PENDIENTE', 'estado_reserva' => 'PROGRAMADA',
    ]);
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('Error al crear reserva: ' . $exception->getMessage());
    sendJson(500, false, 'No fue posible crear la reserva.');
}

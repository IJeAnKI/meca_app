<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
requireMethod('GET');

try {
    $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($id === false || $id === null) sendJson(422, false, 'id debe ser un entero positivo.');
    $sql = "SELECT pt.id_tutor, u.nombre, u.apellido, pt.formacion_academica, pt.precio_hora,
                   pt.promedio_calificacion, pt.estado, pt.certificacion_capacitado,
                   STRING_AGG(DISTINCT mt.nombre_materia, '||' ORDER BY mt.nombre_materia) AS materias
            FROM perfil_tutor pt INNER JOIN usuario u ON u.id_usuario = pt.id_tutor
            LEFT JOIN materia_tutor mt ON mt.id_tutor = pt.id_tutor
            WHERE pt.id_tutor = :id AND pt.estado = 'ACTIVO'
            GROUP BY pt.id_tutor, u.nombre, u.apellido, pt.formacion_academica, pt.precio_hora,
                     pt.promedio_calificacion, pt.estado, pt.certificacion_capacitado";
    $statement = getDatabaseConnection()->prepare($sql);
    $statement->execute([':id' => $id]);
    $tutor = $statement->fetch();
    if (!$tutor) sendJson(404, false, 'Tutor no encontrado');
    $tutor['precio_hora'] = (float) $tutor['precio_hora'];
    $tutor['promedio_calificacion'] = (float) $tutor['promedio_calificacion'];
    $tutor['certificacion_capacitado'] = filter_var($tutor['certificacion_capacitado'], FILTER_VALIDATE_BOOLEAN);
    $tutor['materias'] = $tutor['materias'] ? explode('||', $tutor['materias']) : [];
    sendJson(200, true, 'Tutor obtenido correctamente', $tutor);
} catch (Throwable $exception) {
    error_log('Error al obtener tutor: ' . $exception->getMessage());
    sendJson(500, false, 'No fue posible obtener el tutor.');
}

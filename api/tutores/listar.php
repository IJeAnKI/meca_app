<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
requireMethod('GET');

try {
    $materia = trim((string) ($_GET['materia'] ?? ''));
    if (strlen($materia) > 150) sendJson(422, false, 'El filtro materia supera los 150 caracteres.');
    $precioMax = $_GET['precio_max'] ?? null;
    if ($precioMax !== null && (!is_scalar($precioMax) || filter_var($precioMax, FILTER_VALIDATE_FLOAT) === false || (float) $precioMax < 0)) {
        sendJson(422, false, 'precio_max debe ser un número mayor o igual a cero.');
    }

    $where = ["pt.estado = 'ACTIVO'"];
    $params = [];
    if ($materia !== '') {
        $where[] = "EXISTS (SELECT 1 FROM materia_tutor filtro WHERE filtro.id_tutor = pt.id_tutor AND filtro.nombre_materia ILIKE :materia ESCAPE '\\')";
        $params[':materia'] = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $materia) . '%';
    }
    if ($precioMax !== null) {
        $where[] = 'pt.precio_hora <= :precio_max';
        $params[':precio_max'] = $precioMax;
    }
    $sql = "SELECT pt.id_tutor, u.nombre, u.apellido, pt.formacion_academica, pt.precio_hora,
                   pt.promedio_calificacion, pt.estado, pt.certificacion_capacitado,
                   STRING_AGG(DISTINCT mt.nombre_materia, '||' ORDER BY mt.nombre_materia) AS materias
            FROM perfil_tutor pt INNER JOIN usuario u ON u.id_usuario = pt.id_tutor
            LEFT JOIN materia_tutor mt ON mt.id_tutor = pt.id_tutor
            WHERE " . implode(' AND ', $where) . "
            GROUP BY pt.id_tutor, u.nombre, u.apellido, pt.formacion_academica, pt.precio_hora,
                     pt.promedio_calificacion, pt.estado, pt.certificacion_capacitado
            ORDER BY u.nombre, u.apellido";
    $statement = getDatabaseConnection()->prepare($sql);
    $statement->execute($params);
    $tutores = array_map('normalizarTutor', $statement->fetchAll());
    sendJson(200, true, 'Tutores obtenidos correctamente', $tutores);
} catch (Throwable $exception) {
    error_log('Error al listar tutores: ' . $exception->getMessage());
    sendJson(500, false, 'No fue posible obtener los tutores.');
}

function normalizarTutor(array $tutor): array
{
    $tutor['precio_hora'] = (float) $tutor['precio_hora'];
    $tutor['promedio_calificacion'] = (float) $tutor['promedio_calificacion'];
    $tutor['certificacion_capacitado'] = filter_var($tutor['certificacion_capacitado'], FILTER_VALIDATE_BOOLEAN);
    $tutor['materias'] = $tutor['materias'] ? explode('||', $tutor['materias']) : [];
    return $tutor;
}

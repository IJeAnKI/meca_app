// js/app.js - Lógica de M.E.C.A. usando Supabase Auth + Postgres directamente.
// Ya no existe backend PHP en producción: todo pasa por supabaseClient
// (definido en js/config.js), protegido por las políticas RLS de la BD.
const VISTA_CATALOGO_TUTORES = "vista_catalogo_tutores";

document.addEventListener("DOMContentLoaded", () => {
  configurarLogin();
  configurarRegistro();
  configurarCerrarSesion();
  observarSesion();
  if (document.getElementById("contenedorTutores")) cargarTutores();
});

function mostrarMensaje(id, mensaje, esError = false) {
  const elemento = document.getElementById(id);
  if (!elemento) return;
  elemento.textContent = mensaje;
  elemento.style.color = esError ? "#b91c1c" : "var(--verde-exito)";
}

function mostrarEstado(mensaje) {
  const contenedor = document.getElementById("contenedorTutores");
  if (!contenedor) return;
  contenedor.innerHTML = "";
  const estado = document.createElement("div");
  estado.style.cssText = "grid-column: 1/-1; text-align: center; padding: 2rem;";
  const texto = document.createElement("p");
  texto.style.cssText = "color: var(--texto-secundario); font-size: 1.1rem;";
  texto.textContent = mensaje;
  estado.appendChild(texto);
  contenedor.appendChild(estado);
}

// ============================================================
// SESIÓN (Supabase Auth)
// ============================================================

function observarSesion() {
  // Estado inicial: por si la página carga con una sesión ya guardada
  // en el navegador de una visita anterior.
  supabaseClient.auth.getSession().then(({ data }) => actualizarNavegacionSesion(data.session));

  // Reacciona en vivo a login / logout / renovación automática de token.
  supabaseClient.auth.onAuthStateChange((_evento, session) => actualizarNavegacionSesion(session));
}

function actualizarNavegacionSesion(session) {
  const haySesion = Boolean(session && session.user);

  document.querySelectorAll(".auth-logged-out").forEach((el) => {
    el.style.display = haySesion ? "none" : "";
  });
  document.querySelectorAll(".auth-logged-in").forEach((el) => {
    el.style.display = haySesion ? "" : "none";
  });

  if (haySesion) {
    const metadatos = session.user.user_metadata || {};
    const nombreMostrado = metadatos.nombre ? metadatos.nombre : session.user.email;
    document.querySelectorAll(".nav-user-name").forEach((el) => {
      el.textContent = `Hola, ${nombreMostrado}`;
    });
  }
}

function configurarCerrarSesion() {
  document.querySelectorAll("#btnCerrarSesion").forEach((boton) => {
    boton.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.href = "index.html";
    });
  });
}

// ============================================================
// LOGIN
// ============================================================

function configurarLogin() {
  const formulario = document.getElementById("standaloneLoginForm");
  if (!formulario) return;

  formulario.addEventListener("submit", async (event) => {
    event.preventDefault();
    mostrarMensaje("loginStatus", "Iniciando sesión...");

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      mostrarMensaje("loginStatus", traducirErrorAuth(error), true);
      return;
    }

    mostrarMensaje("loginStatus", "Inicio de sesión correcto. Redirigiendo...");
    setTimeout(() => (window.location.href = "index.html"), 800);
  });
}

// ============================================================
// REGISTRO
// ============================================================

function configurarRegistro() {
  const formulario = document.getElementById("standaloneRegisterForm");
  if (!formulario) return;

  formulario.addEventListener("submit", async (event) => {
    event.preventDefault();
    mostrarMensaje("registerStatus", "Creando cuenta...");

    const nombre = document.getElementById("regNombre").value.trim();
    const apellido = document.getElementById("regApellido").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const institucion = document.getElementById("regInstitucion").value.trim();
    const rol = document.getElementById("regRol").value;
    const password = document.getElementById("regPassword").value;

    // Supabase Auth crea el usuario en auth.users, cifra la contraseña
    // (nunca la vemos ni la guardamos nosotros) y el trigger
    // handle_new_user() crea automáticamente la fila en public.usuario
    // con estos mismos metadatos.
    const { error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { nombre, apellido, institucion, rol },
      },
    });

    if (error) {
      mostrarMensaje("registerStatus", traducirErrorAuth(error), true);
      return;
    }

    mostrarMensaje("registerStatus", "¡Registro exitoso! Redirigiendo...");
    setTimeout(() => (window.location.href = "index.html"), 1200);
  });
}

function traducirErrorAuth(error) {
  const mensaje = (error && error.message) || "";
  if (mensaje.includes("already registered") || mensaje.includes("already exists")) {
    return "Ya existe una cuenta registrada con ese correo.";
  }
  if (mensaje.includes("Invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (mensaje.toLowerCase().includes("password")) {
    return "La contraseña no cumple los requisitos mínimos (8 caracteres).";
  }
  return mensaje || "Ocurrió un error inesperado. Intenta de nuevo.";
}

// ============================================================
// CATÁLOGO DE TUTORES
// ============================================================

async function cargarTutores() {
  const inputMateria = document.getElementById("searchMateria");
  const selectPrecio = document.getElementById("filterPrecio");
  if (!inputMateria || !selectPrecio) return;

  if (!inputMateria.dataset.eventBound) {
    inputMateria.addEventListener("input", filtrarTutores);
    inputMateria.dataset.eventBound = "true";
  }
  if (!selectPrecio.dataset.eventBound) {
    selectPrecio.addEventListener("change", filtrarTutores);
    selectPrecio.dataset.eventBound = "true";
  }

  mostrarEstado("Cargando tutores...");

  try {
    let consulta = supabaseClient.from(VISTA_CATALOGO_TUTORES).select("*").order("nombre");

    // El filtro de precio sí se puede aplicar en la consulta (columna
    // numérica simple). El filtro de materia se aplica en el cliente
    // porque "materias" es un arreglo JSON agregado, no una columna
    // de texto simple sobre la que PostgREST pueda filtrar con ilike.
    const precioMax = selectPrecio.value;
    if (precioMax !== "todos") {
      consulta = consulta.lte("precio_hora", Number(precioMax));
    }

    const { data, error } = await consulta;
    if (error) throw error;

    if (Array.isArray(data) && data.length > 0) {
      renderizarTutores(aplicarFiltrosEnCliente(data));
      return;
    }

    if (typeof tutoresData !== "undefined") {
      renderizarTutores(tutoresDeMuestraFiltrados());
    } else {
      mostrarEstado("No se encontraron tutores con esos criterios.");
    }
  } catch (error) {
    console.error("Error al cargar tutores:", error);
    if (typeof tutoresData !== "undefined") {
      renderizarTutores(tutoresDeMuestraFiltrados());
    } else {
      mostrarEstado("No fue posible cargar los tutores. Intenta de nuevo más tarde.");
    }
  }
}

function aplicarFiltrosEnCliente(lista) {
  const terminoMateria = document.getElementById("searchMateria").value.trim().toLowerCase();

  return lista.filter((tutor) => {
    const nombresMaterias = (tutor.materias || [])
      .map((m) => (typeof m === "object" ? m.nombre_materia || "" : m))
      .join(" ")
      .toLowerCase();

    return !terminoMateria || nombresMaterias.includes(terminoMateria);
  });
}

function tutoresDeMuestraFiltrados() {
  const materia = document.getElementById("searchMateria").value.trim().toLocaleLowerCase("es");
  const precioMaximo = document.getElementById("filterPrecio").value;
  return tutoresData
    .filter((tutor) => {
      const coincideMateria = !materia || tutor.materia.toLocaleLowerCase("es").includes(materia);
      const coincidePrecio = precioMaximo === "todos" || tutor.precioHora <= Number(precioMaximo);
      return coincideMateria && coincidePrecio;
    })
    .map((tutor) => {
      const [nombre, ...apellidos] = tutor.nombre.trim().split(/\s+/);
      return {
        id_tutor: tutor.id,
        nombre,
        apellido: apellidos.join(" "),
        institucion: tutor.institucion,
        materias: [tutor.materia],
        precio_hora: tutor.precioHora,
        promedio_calificacion: tutor.calificacion,
      };
    });
}

function renderizarTutores(lista) {
  const contenedor = document.getElementById("contenedorTutores");
  if (!contenedor) return;
  contenedor.innerHTML = "";
  if (!lista || lista.length === 0) return mostrarEstado("No se encontraron tutores con esos criterios.");

  lista.forEach((tutor) => {
    const card = document.createElement("div");
    card.classList.add("card");

    const titulo = document.createElement("h3");
    titulo.style.cssText = "color: var(--azul-meca); margin-bottom: 0.35rem;";
    titulo.textContent = `${tutor.nombre} ${tutor.apellido}`;
    card.appendChild(titulo);

    if (tutor.institucion) {
      const institucion = document.createElement("p");
      institucion.style.cssText = "color: var(--texto-secundario); margin-bottom: 1rem; font-size: 0.9rem;";
      institucion.textContent = tutor.institucion;
      card.appendChild(institucion);
    }

    const materiasTexto =
      (tutor.materias || [])
        .map((m) => (typeof m === "object" ? m.nombre_materia : m))
        .filter(Boolean)
        .join(", ") || "Sin materias registradas";

    const precio = Number(tutor.precio_hora || tutor.precioHora || 0);
    const calificacion = Number(tutor.promedio_calificacion || tutor.calificacion || 0).toFixed(1);

    const datos = [
      ["Materia(s)", materiasTexto],
      ["Tarifa", `$${precio.toLocaleString("es-CO")} COP / hora`],
      ["Calificación", `⭐ ${calificacion} / 5.0`],
    ];

    datos.forEach(([etiqueta, valor], indice) => {
      const parrafo = document.createElement("p");
      parrafo.style.marginBottom = indice === datos.length - 1 ? "1rem" : "0.4rem";
      const fuerte = document.createElement("strong");
      fuerte.textContent = `${etiqueta}: `;
      parrafo.append(fuerte, document.createTextNode(valor));
      card.appendChild(parrafo);
    });

    const boton = document.createElement("button");
    boton.className = "btn-primary";
    boton.style.width = "100%";
    boton.textContent = "Reservar tutoría";
    boton.addEventListener("click", () => prepararReserva(tutor));
    card.appendChild(boton);

    contenedor.appendChild(card);
  });
}

function filtrarTutores() {
  cargarTutores();
}

async function prepararReserva(tutor) {
  const { data } = await supabaseClient.auth.getSession();
  const session = data.session;

  if (!session) {
    alert("Debes iniciar sesión para reservar una tutoría.");
    window.location.href = "login.html";
    return;
  }

  const rol = (session.user.user_metadata || {}).rol;
  if (rol !== "ASESORADO") {
    alert("Solo las cuentas de tipo 'Estudiante en busca de ayuda' pueden reservar tutorías.");
    return;
  }

  const nombreTutor = tutor.nombre || "el tutor";
  alert(
    `¡Ya iniciaste sesión correctamente! El formulario para elegir fecha y hora con ${nombreTutor} se habilita en el siguiente avance del proyecto.`
  );
}
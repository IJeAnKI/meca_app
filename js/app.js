// js/app.js - Lógica de M.E.C.A. usando Supabase Auth + Postgres directamente.
// Ya no existe backend PHP en producción: todo pasa por supabaseClient
// (definido en js/config.js), protegido por las políticas RLS de la BD.
const VISTA_CATALOGO_TUTORES = "vista_catalogo_tutores";

// Cada página declara, antes de cargar este script, cuántos niveles de
// carpeta la separan de la raíz del sitio, con un <script> inline:
//   páginas en la raíz (index.html):      const RUTA_RAIZ = "";
//   páginas en html/ (login, registro...): const RUTA_RAIZ = "../";
// Así los redirects de abajo funcionan sin importar en qué carpeta viva
// cada página, y sin tener que tocar app.js cada vez que muevan un archivo.
const rutaRaiz = typeof RUTA_RAIZ !== "undefined" ? RUTA_RAIZ : "";

document.addEventListener("DOMContentLoaded", () => {
  protegerLanding();
  configurarLogin();
  configurarRegistro();
  configurarCerrarSesion();
  configurarPerfil();
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
// PROTECCIÓN DE LA LANDING (index.html)
// ============================================================
// La landing (index.html) solo debe ser visible para usuarios con sesión
// activa. Si alguien entra sin sesión, lo mandamos al login. En el resto de
// páginas (login, register, reservas, perfil) esta función no hace nada.
//
// La detección se hace con el atributo data-page="landing" que declaramos en
// el <body> de index.html, para no depender de selectores frágiles.
function protegerLanding() {
  const esLanding = document.body && document.body.dataset.page === "landing";
  if (!esLanding) return;

  supabaseClient.auth.getSession().then(({ data }) => {
    if (!data.session) {
      window.location.replace(`${rutaRaiz}html/login.html`);
    }
  });
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
      // Enviamos directo al login para evitar el "flash" de la landing
      // (que ahora, sin sesión, rebotaría igual al login vía protegerLanding).
      window.location.href = `${rutaRaiz}html/login.html`;
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
    // Ahora sí redirigimos a la landing: con sesión activa, protegerLanding()
    // ya no la rebota al login.
    setTimeout(() => (window.location.href = `${rutaRaiz}index.html`), 800);
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
    // Igual que en el login: con la sesión creada por signUp, la landing
    // ya es accesible y protegerLanding() no la rebota.
    setTimeout(() => (window.location.href = `${rutaRaiz}index.html`), 1200);
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
// PERFIL (M01-ACC: datos personales básicos)
// ============================================================

function configurarPerfil() {
  const formulario = document.getElementById("formPerfil");
  if (!formulario) return;

  cargarMiPerfil();

  formulario.addEventListener("submit", async (event) => {
    event.preventDefault();
    mostrarMensaje("perfilStatus", "Guardando cambios...");

    const { data: sessionData } = await supabaseClient.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      window.location.href = "login.html";
      return;
    }

    const nombre = document.getElementById("perfilNombre").value.trim();
    const apellido = document.getElementById("perfilApellido").value.trim();
    const telefono = document.getElementById("perfilTelefono").value.trim();
    const institucion = document.getElementById("perfilInstitucion").value.trim();

    if (nombre === "" || apellido === "") {
      mostrarMensaje("perfilStatus", "Nombre y apellido no pueden quedar vacíos.", true);
      return;
    }

    const { error } = await supabaseClient
      .from("usuario")
      .update({
        nombre,
        apellido,
        telefono: telefono === "" ? null : telefono,
        institucion: institucion === "" ? null : institucion,
      })
      .eq("id_usuario", session.user.id);

    if (error) {
      mostrarMensaje("perfilStatus", "No se pudo guardar: " + error.message, true);
      return;
    }

    // Los metadatos de auth (usados para el saludo del navbar) también se
    // actualizan, para que el nombre nuevo se refleje sin recargar dos veces.
    await supabaseClient.auth.updateUser({ data: { nombre, apellido, institucion } });

    mostrarMensaje("perfilStatus", "¡Datos actualizados correctamente!");
  });
}

async function cargarMiPerfil() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const session = sessionData.session;

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const campoEmail = document.getElementById("perfilEmail");
  if (campoEmail) campoEmail.textContent = session.user.email;

  // obtener_mi_perfil() es una función RPC (SECURITY DEFINER) porque, por
  // seguridad, el catálogo público solo tiene permiso de leer columnas no
  // sensibles de "usuario" (nombre, apellido, institución). Esta función
  // sí devuelve la fila completa, pero solo la del propio usuario
  // autenticado (auth.uid()), nunca la de otra persona.
  const { data: perfil, error } = await supabaseClient.rpc("obtener_mi_perfil");

  if (error || !perfil) {
    mostrarMensaje("perfilStatus", "No se pudo cargar tu perfil. Intenta recargar la página.", true);
    return;
  }

  document.getElementById("perfilNombre").value = perfil.nombre || "";
  document.getElementById("perfilApellido").value = perfil.apellido || "";
  document.getElementById("perfilTelefono").value = perfil.telefono || "";
  document.getElementById("perfilInstitucion").value = perfil.institucion || "";

  const campoRol = document.getElementById("perfilRol");
  if (campoRol) {
    const etiquetasRol = { ASESORADO: "Estudiante en busca de ayuda", TUTOR: "Tutor / Mentor", ADMIN: "Administrador" };
    campoRol.textContent = etiquetasRol[perfil.rol] || perfil.rol;
  }

  const campoXp = document.getElementById("perfilXp");
  if (campoXp) campoXp.textContent = `${perfil.puntos_xp || 0} XP`;
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
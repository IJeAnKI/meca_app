// Lógica interactiva de M.E.C.A.
const API_TUTORES = "api/tutores/listar.php";
const API_AUTH = "api/auth";
let temporizadorFiltro;
let solicitudTutores;

document.addEventListener("DOMContentLoaded", () => {
  configurarLogin();
  configurarRegistro();
  if (document.getElementById("contenedorTutores")) cargarTutores();
});

function mostrarMensaje(id, mensaje, esError = false) {
  const elemento = document.getElementById(id);
  if (!elemento) return;
  elemento.textContent = mensaje;
  elemento.style.color = esError ? "#b91c1c" : "var(--verde-exito)";
}

async function enviarJson(url, datos) {
  const respuesta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(datos),
  });
  let cuerpo;
  try {
    cuerpo = await respuesta.json();
  } catch {
    throw new Error("La respuesta del servidor no es válida.");
  }
  if (!respuesta.ok || !cuerpo.success) throw new Error(cuerpo.message || "No fue posible realizar la operación.");
  return cuerpo;
}

function configurarLogin() {
  const formulario = document.getElementById("standaloneLoginForm");
  if (!formulario) return;
  formulario.addEventListener("submit", async (event) => {
    event.preventDefault();
    mostrarMensaje("loginStatus", "Iniciando sesión...");
    try {
      const resultado = await enviarJson(`${API_AUTH}/iniciar_sesion.php`, {
        email: document.getElementById("loginEmail").value,
        password: document.getElementById("loginPassword").value,
      });
      mostrarMensaje("loginStatus", `${resultado.message} Redirigiendo...`);
      window.location.href = "index.html";
    } catch (error) {
      mostrarMensaje("loginStatus", error.message, true);
    }
  });
}

function configurarRegistro() {
  const formulario = document.getElementById("standaloneRegisterForm");
  if (!formulario) return;
  formulario.addEventListener("submit", async (event) => {
    event.preventDefault();
    mostrarMensaje("registerStatus", "Creando cuenta...");
    try {
      const resultado = await enviarJson(`${API_AUTH}/registrar.php`, {
        nombre: document.getElementById("regNombre").value,
        apellido: document.getElementById("regApellido").value,
        email: document.getElementById("regEmail").value,
        institucion: document.getElementById("regInstitucion").value,
        rol: document.getElementById("regRol").value,
        password: document.getElementById("regPassword").value,
      });
      mostrarMensaje("registerStatus", `${resultado.message} Redirigiendo...`);
      window.location.href = "index.html";
    } catch (error) {
      mostrarMensaje("registerStatus", error.message, true);
    }
  });
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

function renderizarTutores(lista) {
  const contenedor = document.getElementById("contenedorTutores");
  if (!contenedor) return;
  contenedor.innerHTML = "";
  if (lista.length === 0) return mostrarEstado("No se encontraron tutores con esos criterios.");

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
    const datos = [
      ["Materia(s)", (tutor.materias || []).join(", ") || "Sin materias registradas"],
      ["Tarifa", `$${Number(tutor.precio_hora).toLocaleString("es-CO")} COP / hora`],
      ["Calificación", `⭐ ${Number(tutor.promedio_calificacion).toFixed(1)} / 5.0`],
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

async function cargarTutores() {
  const inputMateria = document.getElementById("searchMateria");
  const selectPrecio = document.getElementById("filterPrecio");
  if (!inputMateria || !selectPrecio) return;
  const parametros = new URLSearchParams();
  if (inputMateria.value.trim()) parametros.set("materia", inputMateria.value.trim());
  if (selectPrecio.value !== "todos") parametros.set("precio_max", selectPrecio.value);
  if (solicitudTutores) solicitudTutores.abort();
  solicitudTutores = new AbortController();
  mostrarEstado("Cargando tutores...");
  try {
    const respuesta = await fetch(`${API_TUTORES}${parametros.size ? `?${parametros}` : ""}`, {
      headers: { Accept: "application/json" }, signal: solicitudTutores.signal,
    });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const cuerpo = await respuesta.json();
    if (cuerpo.success && Array.isArray(cuerpo.data) && cuerpo.data.length === 0 && typeof tutoresData !== "undefined") {
      renderizarTutores(tutoresDeMuestraFiltrados());
      return;
    }
    if (!cuerpo.success || !Array.isArray(cuerpo.data)) throw new Error("Respuesta inválida de la API");
    renderizarTutores(cuerpo.data);
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Error al cargar tutores:", error);
      if (typeof tutoresData !== "undefined") {
        renderizarTutores(tutoresDeMuestraFiltrados());
        return;
      }
      mostrarEstado("No fue posible cargar los tutores. Intenta nuevamente.");
    }
  }
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

function filtrarTutores() {
  clearTimeout(temporizadorFiltro);
  temporizadorFiltro = setTimeout(cargarTutores, 300);
}

function prepararReserva(tutor) {
  alert(`Para reservar con ${tutor.nombre} ${tutor.apellido}, inicia sesión como estudiante en busca de ayuda.`);
}

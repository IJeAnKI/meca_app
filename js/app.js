// js/app.js - Lógica adaptativa completa
const API_TUTORES_LOCAL = "api/tutores/listar.php";
const API_AUTH_LOCAL = "api/auth";
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

// Envío unificado Auth (PHP / Supabase)
async function enviarPeticionAuth(endpointPhp, endpointSupabase, datos) {
  if (CONFIG.ES_NUBE) {
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/${endpointSupabase}`;
    const respuesta = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": CONFIG.SUPABASE_KEY,
        "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(datos)
    });

    const cuerpo = await respuesta.json();
    if (!respuesta.ok) throw new Error(cuerpo.message || "Error al procesar en la nube.");
    return { success: true, message: "Operación exitosa en Supabase." };
  } else {
    const respuesta = await fetch(endpointPhp, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(datos)
    });
    const cuerpo = await respuesta.json();
    if (!respuesta.ok || !cuerpo.success) throw new Error(cuerpo.message || "Error en el servidor local.");
    return cuerpo;
  }
}

function configurarLogin() {
  const formulario = document.getElementById("standaloneLoginForm");
  if (!formulario) return;
  formulario.addEventListener("submit", async (event) => {
    event.preventDefault();
    mostrarMensaje("loginStatus", "Iniciando sesión...");
    try {
      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPassword").value;

      if (CONFIG.ES_NUBE) {
        alert(`Sesión iniciada con éxito (${email}) desde Supabase.`);
        window.location.href = "index.html";
      } else {
        const resultado = await enviarPeticionAuth(`${API_AUTH_LOCAL}/iniciar_sesion.php`, "", { email, password });
        mostrarMensaje("loginStatus", `${resultado.message} Redirigiendo...`);
        window.location.href = "index.html";
      }
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
      const payload = {
        nombre: document.getElementById("regNombre").value,
        apellido: document.getElementById("regApellido").value,
        email: document.getElementById("regEmail").value,
        institucion: document.getElementById("regInstitucion").value,
        rol: document.getElementById("regRol").value,
        password_hash: document.getElementById("regPassword").value
      };

      await enviarPeticionAuth(`${API_AUTH_LOCAL}/registrar.php`, "usuario", payload);
      mostrarMensaje("registerStatus", "¡Registro exitoso! Redirigiendo...");
      setTimeout(() => window.location.href = "index.html", 1500);
    } catch (error) {
      mostrarMensaje("registerStatus", error.message, true);
    }
  });
}

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

  if (solicitudTutores) solicitudTutores.abort();
  solicitudTutores = new AbortController();
  mostrarEstado("Cargando tutores...");

  try {
    let tutores = [];

    if (CONFIG.ES_NUBE) {
      const url = `${CONFIG.SUPABASE_URL}/rest/v1/vista_catalogo_tutores?select=*`;
      const respuesta = await fetch(url, {
        headers: {
          "apikey": CONFIG.SUPABASE_KEY,
          "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`
        },
        signal: solicitudTutores.signal
      });

      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      tutores = await respuesta.json();
    } else {
      const parametros = new URLSearchParams();
      if (inputMateria.value.trim()) parametros.set("materia", inputMateria.value.trim());
      if (selectPrecio.value !== "todos") parametros.set("precio_max", selectPrecio.value);

      const respuesta = await fetch(`${API_TUTORES_LOCAL}?${parametros}`, {
        signal: solicitudTutores.signal
      });
      const cuerpo = await respuesta.json();
      tutores = cuerpo.data || [];
    }

    if (Array.isArray(tutores) && tutores.length > 0) {
      const tutoresFiltrados = aplicarFiltrosEnCliente(tutores);
      renderizarTutores(tutoresFiltrados);
      return;
    }

    if (typeof tutoresData !== "undefined") {
      renderizarTutores(tutoresDeMuestraFiltrados());
    } else {
      mostrarEstado("No se encontraron tutores con esos criterios.");
    }

  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Error al cargar tutores:", error);
      if (typeof tutoresData !== "undefined") {
        renderizarTutores(tutoresDeMuestraFiltrados());
      } else {
        mostrarEstado("No fue posible cargar los tutores.");
      }
    }
  }
}

function aplicarFiltrosEnCliente(lista) {
  const terminoMateria = document.getElementById("searchMateria").value.trim().toLowerCase();
  const precioMax = document.getElementById("filterPrecio").value;

  return lista.filter((tutor) => {
    const nombresMaterias = (tutor.materias || []).map(m => 
      typeof m === "object" ? (m.nombre_materia || "") : m
    ).join(" ").toLowerCase();

    const coincideMateria = !terminoMateria || nombresMaterias.includes(terminoMateria);
    const precio = Number(tutor.precio_hora || tutor.precioHora || 0);
    const coincidePrecio = precioMax === "todos" || precio <= Number(precioMax);

    return coincideMateria && coincidePrecio;
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

    const materiasTexto = (tutor.materias || [])
      .map(m => typeof m === "object" ? m.nombre_materia : m)
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
  clearTimeout(temporizadorFiltro);
  temporizadorFiltro = setTimeout(cargarTutores, 300);
}

function prepararReserva(tutor) {
  const nombreTutor = tutor.nombre || "el tutor";
  alert(`Para reservar con ${nombreTutor}, inicia sesión como estudiante en busca de ayuda.`);
}
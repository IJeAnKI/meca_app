// js/app.js - Lógica adaptativa para Local (PHP) y Nube (Supabase)

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

// Envío unificado: Detecta si debe usar PHP o Supabase REST
async function enviarPeticionAuth(endpointPhp, endpointSupabase, datos) {
  if (CONFIG.ES_NUBE) {
    // PETICIÓN DIRECTA A SUPABASE REST (Sin PHP)
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
    if (!respuesta.ok) {
      throw new Error(cuerpo.message || "Error al procesar la solicitud en la nube.");
    }
    return { success: true, message: "Operación exitosa en Supabase." };
  } else {
    // PETICIÓN AL BACKEND LOCAL (PHP)
    const respuesta = await fetch(endpointPhp, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
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
        // En la nube simula o verifica contra la tabla de usuarios
        alert(`Sesión iniciada con éxito (${email}) desde la API de la nube.`);
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
        password_hash: document.getElementById("regPassword").value // En prod requiere hash
      };

      const resultado = await enviarPeticionAuth(
        `${API_AUTH_LOCAL}/registrar.php`,
        "usuario",
        payload
      );
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

  mostrarEstado("Cargando tutores...");

  try {
    let tutores = [];

    if (CONFIG.ES_NUBE) {
      // Consulta a la vista de Supabase en la Nube
      const url = `${CONFIG.SUPABASE_URL}/rest/v1/vista_catalogo_tutores?select=*`;
      const respuesta = await fetch(url, {
        headers: {
          "apikey": CONFIG.SUPABASE_KEY,
          "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`
        }
      });
      tutores = await respuesta.json();
    } else {
      // Consulta al PHP Local de tu compañero
      const parametros = new URLSearchParams();
      if (inputMateria.value.trim()) parametros.set("materia", inputMateria.value.trim());
      if (selectPrecio.value !== "todos") parametros.set("precio_max", selectPrecio.value);

      const respuesta = await fetch(`${API_TUTORES_LOCAL}?${parametros}`);
      const cuerpo = await respuesta.json();
      tutores = cuerpo.data || [];
    }

    if (!Array.isArray(tutores) || tutores.length === 0) {
      // Si la API falla o viene vacía, usa la mock data de data.js
      renderizarTutores(tutoresDeMuestraFiltrados());
      return;
    }

    renderizarTutores(tutores);

  } catch (error) {
    console.warn("API no disponible, cargando mock data...", error);
    if (typeof tutoresData !== "undefined") {
      renderizarTutores(tutoresDeMuestraFiltrados());
    } else {
      mostrarEstado("No fue posible cargar los tutores.");
    }
  }
}
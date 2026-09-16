// js/app.js - Lógica interactiva de M.E.C.A.

document.addEventListener("DOMContentLoaded", () => {
  // Manejo del formulario independiente de Login (login.html)
  const standaloneLoginForm = document.getElementById("standaloneLoginForm");
  if (standaloneLoginForm) {
    standaloneLoginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value;
      alert(`¡Bienvenido de nuevo (${email})! Has iniciado sesión en M.E.C.A.`);
      window.location.href = "index.html";
    });
  }

  // Manejo del formulario independiente de Registro (register.html)
  const standaloneRegisterForm = document.getElementById(
    "standaloneRegisterForm",
  );
  if (standaloneRegisterForm) {
    standaloneRegisterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const nombre = document.getElementById("regNombre").value;
      alert(
        `¡Registro exitoso, ${nombre}! Tu cuenta en M.E.C.A. ha sido creada.`,
      );
      window.location.href = "index.html";
    });
  }

  // Carga inicial del Catálogo de Tutores en reservas.html
  const contenedorTutores = document.getElementById("contenedorTutores");
  if (contenedorTutores && typeof tutoresData !== "undefined") {
    renderizarTutores(tutoresData);
  }
});

// Función para pintar las tarjetas de tutores en la vista HTML
function renderizarTutores(lista) {
  const contenedor = document.getElementById("contenedorTutores");
  contenedor.innerHTML = "";

  if (lista.length === 0) {
    contenedor.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 2rem;">
        <p style="color: var(--texto-secundario); font-size: 1.1rem;">No se encontraron mentores para los criterios de búsqueda seleccionados.</p>
      </div>
    `;
    return;
  }

  lista.forEach((tutor) => {
    const card = document.createElement("div");
    card.classList.add("card");
    card.innerHTML = `
      <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
        <img src="${tutor.foto}" alt="${tutor.nombre}" style="border-radius: 50%; width: 60px; height: 60px;">
        <div>
          <h3 style="color: var(--azul-meca);">${tutor.nombre}</h3>
          <small style="color: var(--texto-secundario);">${tutor.institucion}</small>
        </div>
      </div>
      <p style="margin-bottom: 0.4rem;"><strong>Materia:</strong> ${tutor.materia}</p>
      <p style="margin-bottom: 0.4rem;"><strong>Tarifa:</strong> $${tutor.precioHora.toLocaleString()} COP / hora</p>
      <p style="margin-bottom: 1rem;"><strong>Calificación:</strong> ⭐ ${tutor.calificacion} / 5.0</p>
      <button class="btn-primary" style="width: 100%;" onclick="simularReserva(${tutor.id})">Reservar Tutoría</button>
    `;
    contenedor.appendChild(card);
  });
}

// Función de filtrado en tiempo real por Asignatura y Precio Máximo
function filtrarTutores() {
  const inputMateria = document.getElementById("searchMateria");
  const selectPrecio = document.getElementById("filterPrecio");

  if (!inputMateria || !selectPrecio) return;

  const textoMateria = inputMateria.value.toLowerCase().trim();
  const precioMax = selectPrecio.value;

  const resultado = tutoresData.filter((tutor) => {
    const coincideMateria = tutor.materia.toLowerCase().includes(textoMateria);
    const coincidePrecio =
      precioMax === "todos" || tutor.precioHora <= parseInt(precioMax);
    return coincideMateria && coincidePrecio;
  });

  renderizarTutores(resultado);
}

// Simulación transaccional de Agendamiento
function simularReserva(idTutor) {
  const tutor = tutoresData.find((t) => t.id === idTutor);
  if (!tutor) return;

  const comisionMeca = tutor.precioHora * 0.15;
  const pagoTutor = tutor.precioHora * 0.85;

  const confirmacion = confirm(
    `¿Deseas agendar la clase con ${tutor.nombre}?\n\n` +
      `Materia: ${tutor.materia}\n` +
      `Valor total: $${tutor.precioHora.toLocaleString()} COP\n\n` +
      `Horarios disponibles:\n- ${tutor.disponibilidad.join("\n- ")}`,
  );

  if (confirmacion) {
    alert(
      `¡Reserva confirmada con éxito!\n\n` +
        `Detalles del Desglose de Pago:\n` +
        `- Cuota M.E.C.A. (15%): $${comisionMeca.toLocaleString()} COP\n` +
        `- Pago para el Mentor (85%): $${pagoTutor.toLocaleString()} COP\n\n` +
        `Se ha generado tu enlace de videollamada para la sesión.`,
    );
  }
}

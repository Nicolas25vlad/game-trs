document.addEventListener("DOMContentLoaded", () => {
    const coverScreen = document.getElementById("coverScreen");
    const mainMenu = document.getElementById("mainMenu");
    const btnAbrirMenu = document.getElementById("btnAbrirMenu");
    const btnModoCarreira = document.getElementById("btnModoCarreira");
    const btnModoHistoria = document.getElementById("btnModoHistoria");
    const btnPartidaRapida = document.getElementById("btnPartidaRapida");
    const btnCreditosMenu = document.getElementById("btnCreditosMenu");
    const modalCreditos = document.getElementById("modalCreditos");
    const btnFechar = document.getElementById("btnFechar");
    const poses = [...document.querySelectorAll(".pose")];
    let activePose = 0;
    let poseTimer;

    const clearPoseStates = () => poses.forEach((pose) => pose.classList.remove("is-entering", "is-active", "is-leaving"));
    const queuePoseExit = () => poses[activePose].classList.replace("is-active", "is-leaving");
    const startPoseSequence = () => {
        window.clearTimeout(poseTimer);
        activePose = 0;
        clearPoseStates();
        poses[activePose].classList.add("is-entering");
    };
    const showMainMenu = () => {
        coverScreen.hidden = true;
        mainMenu.hidden = false;
        startPoseSequence();
        btnModoCarreira.focus();
    };
    const openModal = (modal) => {
        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
    };
    const closeModal = (modal) => {
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
    };

    poses.forEach((pose, index) => {
        pose.addEventListener("animationend", (event) => {
            if (event.animationName === "poseEnter" && pose.classList.contains("is-entering")) {
                pose.classList.replace("is-entering", "is-active");
                poseTimer = window.setTimeout(queuePoseExit, 6200);
            }
            if (event.animationName === "poseExit" && pose.classList.contains("is-leaving")) {
                pose.classList.remove("is-leaving");
                activePose = (index + 1) % poses.length;
                poses[activePose].classList.add("is-entering");
            }
        });
    });

    btnAbrirMenu.addEventListener("click", showMainMenu);
    btnModoCarreira.addEventListener("click", () => alert("Em breve! O Modo Carreira será implementado nas próximas etapas."));
    btnModoHistoria.addEventListener("click", () => alert("Em breve! O Modo História será implementado nas próximas etapas."));
    btnPartidaRapida.addEventListener("click", () => alert("Em breve! A Partida Rápida será implementada nas próximas etapas."));
    btnCreditosMenu.addEventListener("click", () => {
        openModal(modalCreditos);
        btnFechar.focus();
    });
    btnFechar.addEventListener("click", () => closeModal(modalCreditos));
    modalCreditos.addEventListener("click", (event) => {
        if (event.target === modalCreditos) closeModal(modalCreditos);
    });
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (modalCreditos.classList.contains("active")) closeModal(modalCreditos);
    });
});

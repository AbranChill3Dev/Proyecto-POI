const socket = io();

// Elementos de video
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let localStream;
let peerConnection;
let remoteUserId = null;

// Servidores ICE
const iceServers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ]
};

// Obtener cámara y micrófono
async function startLocalStream() {
    console.log("🎥 Obteniendo stream local puto...");
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
}

// Crear conexión P2P
function createPeerConnection() {
    console.log("🛠 Creando RTCPeerConnection...");
    peerConnection = new RTCPeerConnection(iceServers);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Mostrar video remoto
    peerConnection.ontrack = (event) => {
        console.log("📺 Recibiendo video remoto");
        remoteVideo.srcObject = event.streams[0];
    };

    // Mandar candidatos ICE
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("📡 Enviando ICE");
            socket.emit("call:ice-candidate", {
                to: remoteUserId,
                candidate: event.candidate
            });
        }
    };
}

// Cuando YO inicio la llamada
async function startCall(toUserId) {
    remoteUserId = toUserId;
    console.log("📞 Iniciando llamada a:", toUserId);

    await startLocalStream();
    createPeerConnection();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("call:offer", { to: remoteUserId, offer });
}

// Cuando recibo una Call Offer
socket.on("call:offer", async ({ from, offer }) => {
    console.log("📞 Recibí una llamada de:", from);
    remoteUserId = from;

    await startLocalStream();
    createPeerConnection();

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("call:answer", { to: remoteUserId, answer });
});

// Cuando recibo la Answer
socket.on("call:answer", async ({ answer }) => {
    console.log("📩 Recibí respuesta (answer)");
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

// Cuando llega un ICE candidate remoto
socket.on("call:ice-candidate", async ({ candidate }) => {
    if (candidate) {
        console.log("📡 Recibí ICE remoto");
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
});

// Empezar cámara y la llamada (si soy el llamador)
window.onload = async () => {
    console.log("🔹 Página cargada");
    await startLocalStream();

    // 1. INTENTA OBTENER EL ID DEL USUARIO REMOTO DE LA SESIÓN
    const savedRemoteUserId = sessionStorage.getItem("remoteUserId");

    if (savedRemoteUserId) {
        console.log("👉 Soy el LLAMADOR, iniciando WebRTC con:", savedRemoteUserId);
        // 2. SI EXISTE, INICIA LA LLAMADA (ESTOY EN EL LADO DEL LLAMADOR)
        // La función startCall se encargará de crear la conexión y enviar el offer.
        startCall(savedRemoteUserId);
    }

    // 3. LIMPIA LA SESIÓN PARA EVITAR LLAMADAS DUPLICADAS
    sessionStorage.removeItem("remoteUserId");
};

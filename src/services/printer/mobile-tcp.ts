import { Capacitor } from "@capacitor/core";
import { ServiceError } from "@/lib/api";

type TcpClient = string | number;

type TcpSocketConnectPayload = {
    ipAddress: string;
    port: number;
};

type TcpSocketConnectResult = {
    client: TcpClient;
};

type TcpSocketSendPayload = {
    client: TcpClient;
    data: string;
    encoding?: "utf8" | "base64";
};

type TcpSocketDisconnectPayload = {
    client: TcpClient;
};

type TcpSocketApi = {
    connect: (payload: TcpSocketConnectPayload) => Promise<TcpSocketConnectResult>;
    send: (payload: TcpSocketSendPayload) => Promise<unknown>;
    disconnect: (payload: TcpSocketDisconnectPayload) => Promise<unknown>;
};

function parseTcpInterface(interfaceValue?: string) {
    const value = String(interfaceValue ?? "").trim();

    const match = value.match(/^tcp:\/\/([^:/]+):(\d+)$/i);
    if (!match) {
        throw new ServiceError(
            "Mobile printer requires tcp://host:port interface_value",
            400,
        );
    }

    const host = match[1];
    const port = Number(match[2]);

    if (!host || !Number.isFinite(port) || port <= 0) {
        throw new ServiceError("Invalid TCP printer interface_value", 400);
    }

    return { host, port };
}

function normalizeBase64(value: string) {
    return String(value || "")
        .replace(/^data:[^;]+;base64,/i, "")
        .replace(/\s+/g, "")
        .trim();
}

async function sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendBase64InChunks({
    TcpSocket,
    client,
    base64,
    chunkSize = 4096,
    delayMs = 80,
}: {
    TcpSocket: TcpSocketApi;
    client: TcpClient;
    base64: string;
    chunkSize?: number;
    delayMs?: number;
}) {
    const cleanBase64 = normalizeBase64(base64);

    if (!cleanBase64) {
        throw new ServiceError("Missing ESC/POS base64 data", 400);
    }

    const safeChunkSize = Math.max(4, chunkSize - (chunkSize % 4));
    const totalChunks = Math.ceil(cleanBase64.length / safeChunkSize);

    console.log("[mobile-tcp] chunk send config", {
        base64Length: cleanBase64.length,
        safeChunkSize,
        totalChunks,
        delayMs,
        byteEstimate: Math.floor((cleanBase64.length * 3) / 4),
    });

    for (let i = 0; i < cleanBase64.length; i += safeChunkSize) {
        const chunkIndex = Math.floor(i / safeChunkSize) + 1;
        const chunk = cleanBase64.slice(i, i + safeChunkSize);

        console.log("[mobile-tcp] send chunk", {
            chunkIndex,
            totalChunks,
            chunkLength: chunk.length,
        });

        await TcpSocket.send({
            client,
            data: chunk,
            encoding: "base64",
        });

        await sleep(delayMs);
    }

    console.log("[mobile-tcp] all chunks sent", {
        totalChunks,
    });
}

export async function printMobileEscposOverTcp({
    interface_value,
    escpos_base64,
}: {
    interface_value?: string;
    escpos_base64: string;
}) {
    const cleanBase64 = normalizeBase64(escpos_base64);

    console.log("[mobile-tcp] start", {
        interface_value,
        base64Length: cleanBase64.length,
    });

    if (!Capacitor.isNativePlatform()) {
        console.error("[mobile-tcp] not native platform");
        throw new ServiceError(
            "Mobile TCP printing works only inside the Capacitor app.",
            501,
        );
    }

    if (!cleanBase64) {
        throw new ServiceError("Missing ESC/POS base64 data", 400);
    }

    const { host, port } = parseTcpInterface(interface_value);

    console.log("[mobile-tcp] parsed tcp", { host, port });

    const mod = await import("@deedarb/capacitor-tcp-socket");

    console.log("[mobile-tcp] plugin loaded", Object.keys(mod));

    const TcpSocket = mod.TcpSocket as unknown as TcpSocketApi;

    console.log("[mobile-tcp] connect start");

    const connected = await TcpSocket.connect({
        ipAddress: host,
        port,
    });

    console.log("[mobile-tcp] connect success", connected);

    const client = connected.client;

    try {
        console.log("[mobile-tcp] send start", {
            mode: "base64-chunks",
            base64Length: cleanBase64.length,
            byteEstimate: Math.floor((cleanBase64.length * 3) / 4),
        });

        await sendBase64InChunks({
            TcpSocket,
            client,
            base64: cleanBase64,
            chunkSize: 4096,
            delayMs: 80,
        });

        console.log("[mobile-tcp] send success");

        await sleep(500);
    } catch (error) {
        console.error("[mobile-tcp] send failed", error);
        throw error;
    } finally {
        console.log("[mobile-tcp] disconnect start");

        await TcpSocket.disconnect({ client }).catch((error: unknown) => {
            console.error("[mobile-tcp] disconnect failed", error);
        });

        console.log("[mobile-tcp] disconnect done");
    }
}
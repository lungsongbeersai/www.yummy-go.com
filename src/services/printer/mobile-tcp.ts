import { Capacitor } from "@capacitor/core";
import { ServiceError } from "@/lib/api";

type TcpClient = string | number;

type TcpSocketConnectPayload = {
    ipAddress: string;
    port: number;
    timeout?: number;
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

const MOBILE_TCP_CHUNK_SIZE = 2732;
const MOBILE_TCP_CHUNK_DELAY_MS = 40;
const MOBILE_TCP_SEND_TIMEOUT_MS = 15000;
let mobileTcpQueue: Promise<void> = Promise.resolve();

function deliveryError(error: unknown, deliveryState: "not_sent" | "unknown") {
    const wrapped = error instanceof Error
        ? error
        : new Error(String(error || "Unknown printer error"));

    try {
        return Object.assign(wrapped, { delivery_state: deliveryState });
    } catch {
        return Object.assign(new Error(wrapped.message), {
            cause: wrapped,
            delivery_state: deliveryState,
        });
    }
}

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

function runOnMobileTcpQueue<T>(task: () => Promise<T>) {
    // Android plugin เก็บ socket/output stream ไว้เป็นตัวแปรร่วมทั้ง plugin และ
    // connect ใหม่จะปิด socket เดิม ดังนั้นครัวกับบาร์ห้ามส่งพร้อมกันจากมือถือ
    const execution = mobileTcpQueue.then(task, task);
    mobileTcpQueue = execution.then(
        () => undefined,
        () => undefined,
    );
    return execution;
}

function mobileTcpFinalDrainMs(base64Length: number) {
    const estimatedBytes = Math.floor((Math.max(0, base64Length) * 3) / 4);
    return Math.min(1500, 500 + Math.floor(estimatedBytes / (128 * 1024)) * 250);
}

async function withSendTimeout<T>(operation: Promise<T>) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            operation,
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error("Mobile TCP send timed out")),
                    MOBILE_TCP_SEND_TIMEOUT_MS,
                );
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
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

        // การ log ทุก chunk ทำให้ WebView ของ iOS/Android ช้าหนักเมื่อใบยาว
        // เก็บเฉพาะ progress เป็นช่วง ๆ โดยไม่เปลี่ยนข้อมูลที่ส่งเข้า printer
        if (chunkIndex === 1 || chunkIndex === totalChunks || chunkIndex % 25 === 0) {
            console.log("[mobile-tcp] send progress", {
                chunkIndex,
                totalChunks,
                chunkLength: chunk.length,
            });
        }

        await withSendTimeout(
            TcpSocket.send({
                client,
                data: chunk,
                encoding: "base64",
            }),
        );

        if (chunkIndex < totalChunks && delayMs > 0) {
            await sleep(delayMs);
        }
    }

    console.log("[mobile-tcp] all chunks sent", {
        totalChunks,
    });
}

async function printMobileEscposOverTcpNow({
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

    let connected: TcpSocketConnectResult;
    try {
        connected = await TcpSocket.connect({
            ipAddress: host,
            port,
            timeout: 10,
        });
    } catch (error) {
        throw deliveryError(error, "not_sent");
    }

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
            // 2,732 base64 chars = 2,049 raw bytes. ก้อนเล็กลงช่วยเครื่องที่
            // buffer น้อย และ 40 ms ทำให้ใบยาวเร็วขึ้นโดยคงการ pacing ไว้
            chunkSize: MOBILE_TCP_CHUNK_SIZE,
            delayMs: MOBILE_TCP_CHUNK_DELAY_MS,
        });

        console.log("[mobile-tcp] send success");

        // send() ยืนยันแค่ native socket รับก้อนข้อมูลแล้ว ไม่ได้ยืนยันว่า
        // printer ระบายก้อนท้ายครบ จึงเว้นเวลาตามขนาดใบก่อน disconnect
        await sleep(mobileTcpFinalDrainMs(cleanBase64.length));
    } catch (error) {
        console.error("[mobile-tcp] send failed", error);
        // Once a send call starts the printer may have received some/all bytes.
        // Retrying automatically could therefore print a duplicate ticket.
        throw deliveryError(error, "unknown");
    } finally {
        console.log("[mobile-tcp] disconnect start");

        await TcpSocket.disconnect({ client }).catch((error: unknown) => {
            console.error("[mobile-tcp] disconnect failed", error);
        });

        console.log("[mobile-tcp] disconnect done");

    }
}

export function printMobileEscposOverTcp(input: {
    interface_value?: string;
    escpos_base64: string;
}) {
    return runOnMobileTcpQueue(() => printMobileEscposOverTcpNow(input));
}

export const __mobileTcpInternals = {
    mobileTcpFinalDrainMs,
    runOnMobileTcpQueue,
};

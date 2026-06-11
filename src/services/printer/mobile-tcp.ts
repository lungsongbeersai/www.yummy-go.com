import { Capacitor } from "@capacitor/core";
import { ServiceError } from "@/lib/api";

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

export async function printMobileEscposOverTcp({
    interface_value,
    escpos_base64,
}: {
    interface_value?: string;
    escpos_base64: string;
}) {
    if (!Capacitor.isNativePlatform()) {
        throw new ServiceError(
            "Mobile TCP printing works only inside the Capacitor app.",
            501,
        );
    }

    const { host, port } = parseTcpInterface(interface_value);

    if (!escpos_base64) {
        throw new ServiceError("Mobile ESC/POS data missing", 500);
    }

    const mod = await import("@deedarb/capacitor-tcp-socket");
    const TcpSocket = mod.TcpSocket;

    const connected = await TcpSocket.connect({
        ipAddress: host,
        port,
    });

    const client = connected.client;

    try {
        await TcpSocket.send({
            client,
            data: escpos_base64,
        });
    } finally {
        await TcpSocket.disconnect({ client }).catch(() => undefined);
    }
}
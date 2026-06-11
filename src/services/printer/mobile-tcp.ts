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
    console.log("[mobile-tcp] start", {
        interface_value,
        base64Length: escpos_base64?.length,
    });

    if (!Capacitor.isNativePlatform()) {
        console.error("[mobile-tcp] not native platform");
        throw new ServiceError(
            "Mobile TCP printing works only inside the Capacitor app.",
            501,
        );
    }

    const { host, port } = parseTcpInterface(interface_value);

    console.log("[mobile-tcp] parsed tcp", { host, port });

    const mod = await import("@deedarb/capacitor-tcp-socket");

    console.log("[mobile-tcp] plugin loaded", Object.keys(mod));

    const TcpSocket = mod.TcpSocket;

    console.log("[mobile-tcp] connect start");

    const connected = await TcpSocket.connect({
        ipAddress: host,
        port,
    });

    console.log("[mobile-tcp] connect success", connected);

    const client = connected.client;

    try {
        console.log("[mobile-tcp] send start");

        await TcpSocket.send({
            client,
            data: escpos_base64,
        });

        console.log("[mobile-tcp] send success");
    } catch (error) {
        console.error("[mobile-tcp] send failed", error);
        throw error;
    } finally {
        console.log("[mobile-tcp] disconnect start");
        await TcpSocket.disconnect({ client }).catch((error) => {
            console.error("[mobile-tcp] disconnect failed", error);
        });
        console.log("[mobile-tcp] disconnect done");
    }
}
import { QRRedirect } from "@/features/public-pos/qr-redirect";

interface PageProps {
  params: Promise<{ token: string }>;
}

export function generateStaticParams() {
  return [{ token: "sample" }];
}

export default async function Page({ params }: PageProps) {
  const { token } = await params;
  return <QRRedirect token={token} />;
}

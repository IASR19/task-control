import Link from "next/link";

export function BrandMark({
  href = "/quadro",
  size = "rail",
}: {
  href?: string;
  size?: "rail" | "auth";
}) {
  const px = size === "auth" ? 44 : 28;
  return (
    <Link href={href} className={`brand-lockup ${size}`} aria-label="Lousa ops">
      <img src="/logo_lousa.png" alt="" width={px} height={px} className="brand-mark" />
      <span className="brand-text">
        <span className="brand-word">Lousa</span>
        <span className="brand-ops">ops</span>
      </span>
    </Link>
  );
}

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className = "", priority: _priority = false }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${className}`.trim()} aria-label="APMA CRM">
      <img className="brand-logo-light" src="/brand/apma-crm-light.png" alt="APMA CRM" />
      <img className="brand-logo-dark" src="/brand/apma-crm-dark.png" alt="" aria-hidden="true" />
    </span>
  );
}

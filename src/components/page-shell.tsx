export function PageShell({
  title,
  description,
  actions,
  children
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-5 py-6 md:px-7 md:py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-slate-950">{title}</h1>
          {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

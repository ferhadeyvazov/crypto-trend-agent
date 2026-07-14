/** Mərhələ 5-7-də real məzmunla əvəz olunacaq — Mərhələ 4 yalnız naviqasiya/chrome-u yoxlayır. */
export function PagePlaceholder({ stage }: { stage: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-panel p-6 text-sm text-muted">
      {stage}
    </div>
  );
}

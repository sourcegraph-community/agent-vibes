export function getDetailsClass(open: boolean, extra?: string): string {
  return 'rounded-md' + (open ? ' border border-[hsl(var(--border))] overflow-hidden' : '') + (extra ? ' ' + extra : '');
}

export function getSummaryClass(open: boolean): string {
  return 'list-none cursor-pointer select-none flex items-center justify-between gap-3 px-3 py-2 bg-[hsl(var(--input))]' + (open ? ' rounded-t-md' : ' rounded-md');
}

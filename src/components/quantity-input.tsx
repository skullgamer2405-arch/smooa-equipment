import type { Ref } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { MAX_QUANTITY } from "../../shared/inventory.js";

export function QuantityInput({ id, label, value, onChange, min = 1, max = MAX_QUANTITY, disabled = false, error, description, inputRef }: {
  id: string; label: string; value: number; onChange: (value: number) => void;
  min?: number; max?: number; disabled?: boolean; error?: string; description?: string; inputRef?: Ref<HTMLInputElement>;
}) {
  return <div>
    <Label htmlFor={id} className="mb-2 block">{label}</Label>
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" className="size-11 shrink-0 p-0" aria-label={"ลด" + label} disabled={disabled || !Number.isFinite(value) || value <= min} onClick={() => onChange(Math.max(min, value - 1))}><Minus aria-hidden="true" /></Button>
      <Input ref={inputRef} id={id} type="number" inputMode="numeric" min={min} max={max} step={1} required disabled={disabled} value={Number.isFinite(value) ? value : ""} onChange={event => onChange(event.target.value === "" ? NaN : Number(event.target.value))} aria-invalid={Boolean(error)} aria-describedby={[description && id + "-help", error && id + "-error"].filter(Boolean).join(" ") || undefined} className="h-11 w-24 text-center tabular-nums" />
      <Button type="button" variant="outline" className="size-11 shrink-0 p-0" aria-label={"เพิ่ม" + label} disabled={disabled || !Number.isFinite(value) || value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Plus aria-hidden="true" /></Button>
      <span className="text-sm muted">ชิ้น</span>
    </div>
    {description && <p id={id + "-help"} className="mt-2 text-sm muted">{description}</p>}
    {error && <p id={id + "-error"} role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </div>;
}

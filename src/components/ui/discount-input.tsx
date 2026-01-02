import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DollarSign, Percent } from "lucide-react";

interface DiscountInputProps {
  discountType: 'amount' | 'percentage';
  discountValue: number;
  onDiscountTypeChange: (type: 'amount' | 'percentage') => void;
  onDiscountValueChange: (value: number) => void;
}

export function DiscountInput({
  discountType,
  discountValue,
  onDiscountTypeChange,
  onDiscountValueChange,
}: DiscountInputProps) {
  return (
    <div className="space-y-2">
      <Label>Discount</Label>
      <div className="flex gap-2">
        <ToggleGroup
          type="single"
          value={discountType}
          onValueChange={(value) => {
            if (value) onDiscountTypeChange(value as 'amount' | 'percentage');
          }}
          className="shrink-0"
        >
          <ToggleGroupItem value="amount" aria-label="Dollar amount" className="px-3">
            <DollarSign className="w-4 h-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="percentage" aria-label="Percentage" className="px-3">
            <Percent className="w-4 h-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        <Input
          type="number"
          min="0"
          step={discountType === 'percentage' ? '1' : '0.01'}
          max={discountType === 'percentage' ? '100' : undefined}
          placeholder={discountType === 'amount' ? '0.00' : '0'}
          value={discountValue === 0 ? '' : discountValue}
          onChange={(e) => onDiscountValueChange(parseFloat(e.target.value) || 0)}
          className="flex-1"
        />
      </div>
    </div>
  );
}

// Helper function to calculate the discount amount from subtotal
export function calculateDiscountAmount(
  subtotal: number,
  discountType: 'amount' | 'percentage' | null,
  discountValue: number | null
): number {
  if (!discountValue || discountValue <= 0) return 0;
  if (discountType === 'percentage') {
    return subtotal * (discountValue / 100);
  }
  return discountValue;
}

// Helper function to format discount for display
export function formatDiscount(
  discountType: 'amount' | 'percentage' | null,
  discountValue: number | null
): string {
  if (!discountValue || discountValue <= 0) return '';
  if (discountType === 'percentage') {
    return `${discountValue}%`;
  }
  return `$${discountValue.toLocaleString()}`;
}

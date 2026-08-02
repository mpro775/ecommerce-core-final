export interface AllocationLine { key: string; amount: number }

export function allocateLargestRemainder(lines: AllocationLine[], total: number): Map<string, number> {
  const totalMinor = toMinor(total);
  const bases = lines.map((line) => ({ ...line, minor: toMinor(line.amount) }));
  const baseTotal = bases.reduce((sum, line) => sum + line.minor, 0);
  if (totalMinor < 0 || totalMinor > baseTotal) throw new Error('DISCOUNT_ALLOCATION_INVALID');
  if (totalMinor === 0 || baseTotal === 0) return new Map(lines.map((line) => [line.key, 0]));
  const allocated = bases.map((line) => {
    const numerator = line.minor * totalMinor;
    return { key: line.key, minor: Math.floor(numerator / baseTotal), remainder: numerator % baseTotal };
  });
  let remaining = totalMinor - allocated.reduce((sum, line) => sum + line.minor, 0);
  allocated.sort((a,b) => b.remainder-a.remainder || a.key.localeCompare(b.key));
  for (let index=0;remaining>0;index=(index+1)%allocated.length,remaining-=1) allocated[index]!.minor+=1;
  return new Map(allocated.map((line) => [line.key, fromMinor(line.minor)]));
}

export function toMinor(value: number): number {
  if (!Number.isFinite(value)) throw new Error('MONEY_VALUE_INVALID');
  return Math.round((value + Number.EPSILON) * 100);
}
export function fromMinor(value: number): number { return value / 100; }

export function allocateDiscountStages(
  bases: AllocationLine[],
  input: {
    offerEligibleKeys: string[];
    couponEligibleKeys: string[];
    offerDiscount: number;
    couponDiscount: number;
    loyaltyDiscount: number;
  },
): Map<string, number> {
  const keys = new Set(bases.map((line) => line.key));
  const offerEligible = new Set(input.offerEligibleKeys);
  const couponEligible = new Set(input.couponEligibleKeys);
  const offer = allocateLargestRemainder(
    bases.filter((line) => offerEligible.has(line.key)),
    input.offerDiscount,
  );
  const afterOffer = bases.map((line) => ({
    key: line.key,
    amount: Number((line.amount - (offer.get(line.key) ?? 0)).toFixed(2)),
  }));
  const coupon = allocateLargestRemainder(
    afterOffer.filter((line) => couponEligible.has(line.key)),
    input.couponDiscount,
  );
  const afterCoupon = afterOffer.map((line) => ({
    key: line.key,
    amount: Number((line.amount - (coupon.get(line.key) ?? 0)).toFixed(2)),
  }));
  const loyalty = allocateLargestRemainder(afterCoupon, input.loyaltyDiscount);
  return new Map([...keys].map((key) => [key, Number((
    (offer.get(key) ?? 0) + (coupon.get(key) ?? 0) + (loyalty.get(key) ?? 0)
  ).toFixed(2))]));
}

import { z } from "zod";
import { isAddress } from "viem";

export const claimSchema = z.object({
  address: z
    .string()
    .trim()
    .refine((val) => isAddress(val), {
      message: "Invalid Ethereum address",
    }),
  turnstileToken: z.string().min(1, "CAPTCHA verification required"),
});

export type ClaimInput = z.infer<typeof claimSchema>;

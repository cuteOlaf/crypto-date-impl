import { BigNumber } from "ethers";

export const UNLIMITED_ALLOWANCE_IN_BASE_UNITS = BigNumber.from(2).pow(256).sub(1);

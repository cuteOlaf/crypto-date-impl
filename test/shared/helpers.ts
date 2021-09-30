import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Contract } from "ethers";
import * as hre from 'hardhat';
import { CryptoDate,   ERC20__factory  } from "../../typechain";
import UniswapV2Router02 from '@uniswap/v2-periphery/build/UniswapV2Router02.json'
import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json'
import { FixtureAddresses } from "./fixture";
export const DAY = 86400;
export const TOLERANCE_FOR_TESTS = ethers.utils.parseEther(".0001").toNumber();
export async function depositToCDT_WETHLiquidityPool(signer: SignerWithAddress, amountOfCDT: string, fixtureAddress: FixtureAddresses): Promise<BigNumber> {
    const CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, signer);
    const CDTWETHContract = ERC20__factory.connect(fixtureAddress.CDT_WETH_PAIR_ADDRESS, signer);
    await CDTContract.approve(fixtureAddress.ROUTER, ethers.utils.parseEther("10000"));
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current Unix time
    const routerForUser = new Contract(fixtureAddress.ROUTER, JSON.stringify(UniswapV2Router02.abi), ethers.provider).connect(signer);
    //get reserves to get ratio for adding liquidity
    const CDT_WETH_PAIRContract = new Contract(fixtureAddress.CDT_WETH_PAIR_ADDRESS, JSON.stringify(IUniswapV2Pair.abi), ethers.provider).connect(signer);
    const reserves = await CDT_WETH_PAIRContract.getReserves();
    const token0 = await CDT_WETH_PAIRContract.token0();
    const reserveCDT: BigNumber = token0 == fixtureAddress.CDT_ADDRESS ? reserves.reserve0 : reserves.reserve1;
    const reserveETH: BigNumber = token0 == fixtureAddress.WETH_ADDRESS ? reserves.reserve0 : reserves.reserve1;
    const amountOfETH: BigNumber = await routerForUser.quote(ethers.utils.parseEther(amountOfCDT), reserveCDT, reserveETH);
    //disregard slippage
    await routerForUser.addLiquidityETH(fixtureAddress.CDT_ADDRESS, ethers.utils.parseEther(amountOfCDT),
        "0",
        "0",
        signer.address, deadline, { value: amountOfETH });
    const balanceOfLPTokens = await CDTWETHContract.balanceOf(signer.address);
    await CDTWETHContract.approve(fixtureAddress.LIQUIDITY_REWARDS, ethers.utils.parseEther("10000"));
    return balanceOfLPTokens;
}
export async function mintCryptoDate(signer: SignerWithAddress, cryptoDate:CryptoDate) {
    const year = randomIntFromInterval(1900, 2099);
    const month = randomIntFromInterval(1, 12);
    const day = randomIntFromInterval(1, 28);
    //todo make sure it isn't minted in legacy
    const priceInETH: BigNumber = await cryptoDate.getPriceInETH(month, day);
    await cryptoDate.mintWithETH(signer.address, year, month, day, { value: priceInETH });

}
function randomIntFromInterval(min: number, max: number) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
}
export async function advanceTime(secondsToAdd: number) {
    await ethers.provider.send("evm_increaseTime", [secondsToAdd]);
    await ethers.provider.send("evm_mine", []);
    
}
export async function resetBlockToZero(){
    await hre.network.provider.request({
        method: "hardhat_reset",
        params: []
    });

}
export async function sleep(sec: number) {
    return new Promise(resolve => setTimeout(resolve, sec * 1000));
}

import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import chai from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { CryptoDate, CryptoDate__factory, ERC20__factory, IERC20__factory, IUniswapV2Router02__factory, StakingRewards, StakingRewards__factory } from "../typechain";
import { deployFixture, FixtureAddresses } from "./shared/fixture";
import { BigNumber, Contract } from "ethers";
import {  advanceTime, DAY, mintCryptoDate } from "./shared/helpers";
import { IUniswapV2Router01__factory } from "../typechain/factories/IUniswapV2Router01__factory";
import { IWETH__factory } from "../typechain/factories/IWETH__factory";
import { IUniswapV2Pair__factory } from "../typechain/factories/IUniswapV2Pair__factory";

chai.use(solidity);
const { expect } = chai;

describe("Scenarios Tests", async () => {
    let fixtureAddress: FixtureAddresses;
    let operations: SignerWithAddress;
    let user: SignerWithAddress;
    let treasury: SignerWithAddress;
    let user2: SignerWithAddress;

    before(async () => {
        [operations, user, treasury, user2] = await ethers.getSigners();
    });
    
    it("minting still works if reward tokens gone", async () => {
        fixtureAddress = await deployFixture(BigNumber.from("1"));
        const cryptoDateContract: CryptoDate = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        const CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, user);
        //clear user balance of CDT to make test simpler
        await CDTContract.transfer(treasury.address, await CDTContract.balanceOf(user.address));
        //minting succeeds but user doesn't get reward
        await mintCryptoDate(user, cryptoDateContract);
        expect(await CDTContract.balanceOf(user.address)).to.eq(BigNumber.from("0"));
    });

});

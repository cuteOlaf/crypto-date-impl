import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import chai from "chai";
import { BigNumber, Contract } from "ethers";
import { CryptoDate__factory } from "../typechain/factories/CryptoDate__factory";
import UniswapV2Router02 from '@uniswap/v2-periphery/build/UniswapV2Router02.json'
import { CryptoDate, IUniswapV2Router01__factory } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ERC20__factory } from "../typechain/factories/ERC20__factory";
import { deployFixture, FixtureAddresses } from "./shared/fixture";
import { mintCryptoDate, sleep, TOLERANCE_FOR_TESTS } from "./shared/helpers";
import { IWETH__factory } from "../typechain/factories/IWETH__factory";
import { IUniswapV2Pair__factory } from "../typechain/factories/IUniswapV2Pair__factory";
chai.use(solidity);
const { expect } = chai;
describe("NFT Minting and Price Tests", async () => {
    let fixtureAddress: FixtureAddresses;
    let operations: SignerWithAddress;
    let user: SignerWithAddress;
    let treasury: SignerWithAddress;
    before(async () => {
        [operations, user, treasury] = await ethers.getSigners();
    });
    beforeEach(async () => {
        fixtureAddress = await deployFixture();
    });


    it("price in eth is correct", async () => {
        const cryptoDateContract = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        let priceInETH: BigNumber = await cryptoDateContract.getPriceInETH(2, 29);
        //all leap year days are worth 10 eth
        expect(priceInETH).to.be.eq(ethers.utils.parseEther("10"));
        priceInETH = await cryptoDateContract.getPriceInETH(2, 29);
        //matching month day
        priceInETH = await cryptoDateContract.getPriceInETH(3, 3);
        expect(priceInETH).to.be.eq(ethers.utils.parseEther("1"));
        priceInETH = await cryptoDateContract.getPriceInETH(4, 4);
        expect(priceInETH).to.be.eq(ethers.utils.parseEther("1"));
        priceInETH = await cryptoDateContract.getPriceInETH(12, 12);
        expect(priceInETH).to.be.eq(ethers.utils.parseEther("1"));
        priceInETH = await cryptoDateContract.getPriceInETH(11, 11);
        expect(priceInETH).to.be.eq(ethers.utils.parseEther("1"));
        //all else are worth .1 eth
        priceInETH = await cryptoDateContract.getPriceInETH(1, 29);
        expect(priceInETH).to.be.eq(ethers.utils.parseEther(".1"));
        priceInETH = await cryptoDateContract.getPriceInETH(10, 21);
        expect(priceInETH).to.be.eq(ethers.utils.parseEther(".1"));
        priceInETH = await cryptoDateContract.getPriceInETH(1, 2);
        expect(priceInETH).to.be.eq(ethers.utils.parseEther(".1"));
        priceInETH = await cryptoDateContract.getPriceInETH(12, 31);
        expect(priceInETH).to.be.eq(ethers.utils.parseEther(".1"));
    });
    it("invalid dates fail", async () => {
        // mint by spending ETH
        const cryptoDateContract: CryptoDate = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        let priceInETH: BigNumber = await cryptoDateContract.getPriceInETH(1,1);
        //out of valid range
        await expect( cryptoDateContract.mintWithETH(user.address, 1949, 3, 23, { value:priceInETH })).to.be.revertedWith("invalid date");
        //out of valid range
        await expect( cryptoDateContract.mintWithETH(user.address, 2051, 3, 23, { value:priceInETH })).to.be.revertedWith("invalid date");
        //invalid dates
        await expect( cryptoDateContract.mintWithETH(user.address, 2000, 13, 23, { value:priceInETH })).to.be.revertedWith("invalid date");
        await expect( cryptoDateContract.mintWithETH(user.address, 2000, 3, 100, { value:priceInETH })).to.be.revertedWith("invalid date");
        await expect( cryptoDateContract.mintWithETH(user.address, 2000, 2, 31, { value:priceInETH })).to.be.revertedWith("invalid date");
        await expect( cryptoDateContract.mintWithETH(user.address, 2000, 0, 31, { value:priceInETH })).to.be.revertedWith("invalid date");
        await expect( cryptoDateContract.mintWithETH(user.address, 2000, 1, 0, { value:priceInETH })).to.be.revertedWith("invalid date");
        //not a leap year
        priceInETH = await cryptoDateContract.getPriceInETH(2, 29);
        await expect( cryptoDateContract.mintWithETH(user.address, 2001, 2, 29, { value:priceInETH })).to.be.revertedWith("invalid date");
    });
    it("dates create correct token id", async () => {
        // mint by spending ETH
        const cryptoDateContract: CryptoDate = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        const priceInETH: BigNumber = await cryptoDateContract.getPriceInETH(1,1);
        await cryptoDateContract.mintWithETH(user.address, "2000", "10", "20", { value:priceInETH });
        expect(await cryptoDateContract.ownerOf("20001020")).to.eq(user.address);
        await cryptoDateContract.mintWithETH(user.address, "2000", "1", "2", { value:priceInETH });
        expect(await cryptoDateContract.ownerOf("20000102")).to.eq(user.address);
        await cryptoDateContract.mintWithETH(user.address, "2000", "4", "12", { value:priceInETH });
        expect(await cryptoDateContract.ownerOf("20000412")).to.eq(user.address);
        await cryptoDateContract.mintWithETH(user.address, "2000", "11", "2", { value:priceInETH });
        expect(await cryptoDateContract.ownerOf("20001102")).to.eq(user.address);
    });

    it("minting standard dates works", async () => {
        // mint by spending ETH
        const cryptoDateContract: CryptoDate = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        const priceInETH: BigNumber = await cryptoDateContract.getPriceInETH(1, 10);
        expect(priceInETH).to.be.eq(ethers.utils.parseEther(".1"));

        const ethBalance = await ethers.provider.getBalance(user.address);
        const tx = await cryptoDateContract.mintWithETH(user.address, "2010", "1", "10", { value: priceInETH });
        const receipt = await tx.wait();

        const gasCost = ethers.utils.parseUnits("2", "gwei");
        const txCost = gasCost.mul(receipt.gasUsed)
        expect(await cryptoDateContract.ownerOf("20100110")).to.eq(user.address);
        expect(await ethers.provider.getBalance(user.address)).to.eq(ethBalance.sub(txCost).sub(priceInETH));

    });
    it("minting limited edition dates works", async () => {
        // mint by spending ETH
        const cryptoDateContract: CryptoDate = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        const priceInETH: BigNumber = await cryptoDateContract.getPriceInETH(1, 1);
        expect(priceInETH).to.be.eq(ethers.utils.parseEther("1"));

        const ethBalance = await ethers.provider.getBalance(user.address);
        const tx = await cryptoDateContract.mintWithETH(user.address, "2010", "1", "1", { value: priceInETH });
        const receipt = await tx.wait();

        const gasCost = ethers.utils.parseUnits("2", "gwei");
        const txCost = gasCost.mul(receipt.gasUsed)
        expect(await cryptoDateContract.ownerOf("20100101")).to.eq(user.address);
        expect(await ethers.provider.getBalance(user.address)).to.eq(ethBalance.sub(txCost).sub(priceInETH));

    });
    it("minting premium dates works", async () => {
        // mint by spending ETH
        const cryptoDateContract: CryptoDate = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        const priceInETH: BigNumber = await cryptoDateContract.getPriceInETH(2, 29);
        expect(priceInETH).to.be.eq(ethers.utils.parseEther("10"));

        const ethBalance = await ethers.provider.getBalance(user.address);
        const tx = await cryptoDateContract.mintWithETH(user.address, "2008", "2", "29", { value: priceInETH });
        const receipt = await tx.wait();

        const gasCost = ethers.utils.parseUnits("2", "gwei");
        const txCost = gasCost.mul(receipt.gasUsed)
        expect(await cryptoDateContract.ownerOf("20080229")).to.eq(user.address);
        expect(await ethers.provider.getBalance(user.address)).to.eq(ethBalance.sub(txCost).sub(priceInETH));

    });
    it("minting distributes funds to treasury", async () => {
        const cryptoDateContract: CryptoDate = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        const priceInETH: BigNumber = await cryptoDateContract.getPriceInETH(2, 29);
        const ethBalanceOfTreasury = await ethers.provider.getBalance(treasury.address);
        await cryptoDateContract.mintWithETH(user.address, "2008", "2", "29", { value: priceInETH });
        //treasury gets half the ETH
        expect(await ethers.provider.getBalance(treasury.address)).to.be.eq(ethBalanceOfTreasury.add(priceInETH.div("2")));

    });
    it("minting adds liquidity to pool without changing price", async () => {
        const cryptoDateContract: CryptoDate = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        const CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, user);
        const router = IUniswapV2Router01__factory.connect(fixtureAddress.ROUTER, operations);
        const weth = IWETH__factory.connect(fixtureAddress.WETH_ADDRESS, operations);
        const pair = IUniswapV2Pair__factory.connect(fixtureAddress.CDT_WETH_PAIR_ADDRESS, operations);
        const amountsOut = await router.getAmountsOut(ethers.utils.parseEther("1"), [fixtureAddress.CDT_ADDRESS, fixtureAddress.WETH_ADDRESS]);
        const reserves = await pair.getReserves();

        const priceInETH: BigNumber = await cryptoDateContract.getPriceInETH(2, 2);
        await cryptoDateContract.mintWithETH(user.address, "2008", "2", "2", { value: priceInETH });
        const amountsOut2 = await router.getAmountsOut(ethers.utils.parseEther("1"), [fixtureAddress.CDT_ADDRESS, fixtureAddress.WETH_ADDRESS]);
        const reservesNew = await pair.getReserves();
        //shifts price to make CDT worth more
        expect(amountsOut2[1]).to.be.gt(amountsOut[1]);
        //adds 90% of CDT to lp pool
        expect(reservesNew.reserve0).to.be.eq(reserves.reserve0.add(ethers.utils.parseEther("900")));
        //adds half of eth to lp pool
        expect(reservesNew.reserve1).to.be.eq(reserves.reserve1.add(priceInETH.div(2)));

    });
    it("minting distributes CDT rewards to buyer", async () => {
        const cryptoDateContract: CryptoDate = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        const CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, user);
        //clear user balance of CDT to make test simpler
        await CDTContract.transfer(treasury.address, await CDTContract.balanceOf(user.address));
        const priceInETH: BigNumber = await cryptoDateContract.getPriceInETH(1, 1);
        await cryptoDateContract.mintWithETH(user.address, "2010", "1", "1", { value: priceInETH });
        //user gets reward
        const expectedReward = priceInETH.mul("100");
        expect(await CDTContract.balanceOf(user.address)).to.eq(expectedReward);
    });
    it("sending too little when minting fails", async () => {
        // mint by spending ETH
        const cryptoDateContract: CryptoDate = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        const priceInETH: BigNumber = await cryptoDateContract.getPriceInETH(3, 23);
        await expect( cryptoDateContract.mintWithETH(user.address, 2004, 3, 23, { value:priceInETH.sub(BigNumber.from("1"))})).to.be.revertedWith("INSUFFICIENT ETH");
    });

    it("cannot mint v1 cryptodate", async ()=> {
        const cryptoDateContract: CryptoDate = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        //this date does exist in legacy contract
        const priceInETH: BigNumber = await cryptoDateContract.getPriceInETH(2, 10);
        await expect( cryptoDateContract.mintWithETH(user.address, 1972, 2, 10, { value:priceInETH})).to.be.revertedWith("Date already minted.");

    });
    it("can migrate legacy date", async ()=> {
        const cryptoDateContract: CryptoDate = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        //this date does exist in legacy contract
        await cryptoDateContract.migrationMint("19720210");
        expect(await cryptoDateContract.ownerOf("19720210")).to.be.eq("0xDcae967431FB51aa7453EC6C06fA544C25e0f1ff");
    });
    it("can only migrate mint if legacy date", async ()=> {
        const cryptoDateContract: CryptoDate = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, operations);
        //this date does not exist in legacy contract
        await expect( cryptoDateContract.migrationMint("19720211")).to.be.revertedWith("ERC721: owner query for nonexistent token");
    });
    it("should return correct tokenURI", async () => {
        const cryptoDateContract: CryptoDate = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        const priceInETH: BigNumber = await cryptoDateContract.getPriceInETH(10, 1);
        await  cryptoDateContract.mintWithETH(user.address, 2001, 10, 1, { value:priceInETH});
        const uri = await cryptoDateContract.tokenURI(20011001);
        expect(uri).to.be.equal("https://api.cryptodate.io/date/20011001");
    });
    it("can update price", async ()=> {
        const cryptoDateContract: CryptoDate = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, operations);
        await cryptoDateContract.updatePrice(ethers.utils.parseEther(".5"));
        let priceInETH: BigNumber = await cryptoDateContract.getPriceInETH(10, 1);
        expect(priceInETH).to.be.eq(ethers.utils.parseEther(".5"));

    });

});

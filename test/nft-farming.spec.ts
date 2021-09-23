import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import chai from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { CryptoDate, CryptoDateToken, CryptoDateToken__factory, CryptoDate__factory, ERC20__factory  } from "../typechain";
import { deployFixture, FixtureAddresses } from "./shared/fixture";
import { advanceTime, DAY, mintCryptoDate, TOLERANCE_FOR_TESTS } from "./shared/helpers";
import { BigNumber } from "ethers";
chai.use(solidity);
const { expect } = chai;
describe("NFT Farming Tests", async () => {
    let fixtureAddress: FixtureAddresses;
    let operations: SignerWithAddress;
    let user: SignerWithAddress;
    let treasury: SignerWithAddress;
    let user2: SignerWithAddress;

    before(async () => {
        [operations, user, treasury, user2] = await ethers.getSigners();
    });
    beforeEach(async () => {
        fixtureAddress = await deployFixture();
    });
    it("can get reward", async () => {
        const CDTContract:CryptoDateToken = CryptoDateToken__factory.connect(fixtureAddress.CDT_ADDRESS, user);
        const cryptoDate:CryptoDate =  CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        await mintCryptoDate(user, cryptoDate);
        await advanceTime(DAY * 366);
        //clear balance of CDT to make math simpler
        await CDTContract.transfer(treasury.address, await CDTContract.balanceOf(user.address));
        let earned = await cryptoDate.earned(user.address);
        expect(earned).to.be.closeTo(ethers.utils.parseEther("100"), TOLERANCE_FOR_TESTS);
        await cryptoDate.getReward();
        expect(await CDTContract.balanceOf(user.address)).to.eq(earned);
    });
    it("reward rate is fixed across users and dates", async () => {
        const cryptoDate:CryptoDate =  CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        await mintCryptoDate(user, cryptoDate);
        await mintCryptoDate(user, cryptoDate);
        const cryptoDate2:CryptoDate =  CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user2);
        await mintCryptoDate(user2, cryptoDate2);
        await advanceTime(DAY * 366);
        let earned = await cryptoDate.earned(user.address);
        expect(earned).to.be.closeTo(ethers.utils.parseEther("200"), TOLERANCE_FOR_TESTS);
        earned = await cryptoDate.earned(user2.address);
        expect(earned).to.be.closeTo(ethers.utils.parseEther("100"), TOLERANCE_FOR_TESTS);
    });
    it("rewards end when period concludes", async () => {
        const cryptoDate:CryptoDate =  CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        await mintCryptoDate(user, cryptoDate);
        //advance time two days beyond period end; should still only be 2 reward
        await advanceTime(DAY * 500);
        let earned = await cryptoDate.earned(user.address);
        expect(earned).to.be.closeTo(ethers.utils.parseEther("100"), TOLERANCE_FOR_TESTS);
    });
    it("rewards are no longer distributed after transfer", async () => {
        const cryptoDate:CryptoDate =  CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        await mintCryptoDate(user, cryptoDate);
        //advance through half the earning period 
        const secondsInAYear = DAY * 365;
        const halfYearInSeconds = secondsInAYear / 2;
        await advanceTime(halfYearInSeconds);
        let earned = await cryptoDate.earned(user.address);
        expect(earned).to.be.closeTo(ethers.utils.parseEther("50"), TOLERANCE_FOR_TESTS);
        //transfer
        const tokenId = await cryptoDate.tokenOfOwnerByIndex(user.address, 0);
        await cryptoDate.transferFrom(user.address, user2.address, tokenId);
        await advanceTime(halfYearInSeconds);
        let earned2 = await cryptoDate.earned(user.address);
        //since they transferred their date and have no more, they
        //shouldn't be earning any more interest
        expect(earned2).to.be.closeTo(earned, TOLERANCE_FOR_TESTS);
        const earned3 = await cryptoDate.earned(user2.address);
        //user 2 should have earned the other half of the interest for this nft
        expect(earned3).to.be.closeTo(ethers.utils.parseEther("50"), TOLERANCE_FOR_TESTS);
    });
    it("cannot start new rewards period while farming in progress", async () => {
        const cryptoDate:CryptoDate =  CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        await (expect(cryptoDate.extendRewards()).to.be.revertedWith("rewards still in progress"));
    });
    it("can get rewards from new period", async () => {
        const CDTContract:CryptoDateToken = CryptoDateToken__factory.connect(fixtureAddress.CDT_ADDRESS, user);
        const cryptoDate:CryptoDate =  CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
        await mintCryptoDate(user, cryptoDate);
        await advanceTime(DAY * 366);
        //clear balance of CDT to make math simpler
        await CDTContract.transfer(treasury.address, await CDTContract.balanceOf(user.address));
        let earned = await cryptoDate.earned(user.address);
        expect(earned).to.be.closeTo(ethers.utils.parseEther("100"), TOLERANCE_FOR_TESTS);
        await cryptoDate.extendRewards();
        await advanceTime(DAY  * 366);
        earned = await cryptoDate.earned(user.address);
        expect(earned).to.be.closeTo(ethers.utils.parseEther("200"), TOLERANCE_FOR_TESTS);
    });


});
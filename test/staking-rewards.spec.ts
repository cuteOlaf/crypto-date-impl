import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import chai from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {  CryptoDate, CryptoDate__factory, ERC20__factory } from "../typechain";
import { deployFixture, FixtureAddresses } from "./shared/fixture";
import { advanceTime, DAY, depositToCDT_WETHLiquidityPool, mintCryptoDate, TOLERANCE_FOR_TESTS } from "./shared/helpers";
import { StakingRewards } from "../typechain/StakingRewards";
import { StakingRewards__factory } from "../typechain/factories/StakingRewards__factory";
import { BigNumber } from "ethers";
chai.use(solidity);
const { expect } = chai;
describe("Staking Rewards Tests", async () => {
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
    it("cannot start rewards if no reward tokens in contract", async () => {
        const stakingRewards: StakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, treasury);
        await (expect(stakingRewards.startRewards(ethers.utils.parseEther("100"), DAY * 30)).to.be.revertedWith("Provided reward too high"));
    });
    it("cannot start rewards if reward amount is 0 ", async () => {
        const stakingRewards: StakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, treasury);
        await (expect(stakingRewards.startRewards(ethers.utils.parseEther("0"), DAY * 30)).to.be.revertedWith("reward too small"));
    });
    it("cannot start rewards if no reward duration is 0", async () => {
        const stakingRewards: StakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, treasury);
        await (expect(stakingRewards.startRewards(ethers.utils.parseEther("1"), 0)).to.be.revertedWith("reward duration too small"));
    });
    it("cannot start rewards if no reward tokens in contract", async () => {
        const stakingRewards: StakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, treasury);
        const CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, treasury);
        await (expect(stakingRewards.startRewards(ethers.utils.parseEther("100"), DAY * 30)).to.be.revertedWith("Provided reward too high"));
    });
    it("cannot start rewards while farming in progress", async () => {
        let stakingRewards: StakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, treasury);
        let CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, treasury);
        await CDTContract.transfer(stakingRewards.address, ethers.utils.parseEther("100"));
        await stakingRewards.startRewards(ethers.utils.parseEther("100"), DAY * 30);
        await (expect(stakingRewards.startRewards(ethers.utils.parseEther("100"), DAY * 30)).to.be.revertedWith("rewards still in progress"));
    });
    it("can start rewards", async () => {
        const stakingRewards: StakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, treasury);
        const CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, treasury);
        //fund staking contract and start reward period
        await CDTContract.transfer(stakingRewards.address, ethers.utils.parseEther("100"));
        await stakingRewards.startRewards(ethers.utils.parseEther("100"), DAY * 30);
    });
    it("can start rewards after rewards period ends", async () => {
        const stakingRewards: StakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, treasury);
        const CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, treasury);
        //fund staking contract and start reward period
        await CDTContract.transfer(stakingRewards.address, ethers.utils.parseEther("200"));
        await stakingRewards.startRewards(ethers.utils.parseEther("100"), DAY * 30);
        await advanceTime(DAY * 31);
        await stakingRewards.startRewards(ethers.utils.parseEther("100"), DAY * 30);

    });
    it("can get rewards", async () => {
        let stakingRewards: StakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, treasury);
        let CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, treasury);
        await CDTContract.transfer(stakingRewards.address, ethers.utils.parseEther("100"));
        await stakingRewards.startRewards(ethers.utils.parseEther("100"), DAY * 30);
        stakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, user);
        CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, user);
        await CDTContract.approve(stakingRewards.address, ethers.utils.parseEther("10000000"));
        await stakingRewards.stake(ethers.utils.parseEther("1"));
        //clear balance of user for easier math
        await CDTContract.transfer(treasury.address, await CDTContract.balanceOf(user.address));
        await advanceTime(DAY * 31);
        let earned = await stakingRewards.earned(user.address);
        await stakingRewards.getReward();
        expect(earned).to.be.closeTo( ethers.utils.parseEther("100"), TOLERANCE_FOR_TESTS);
        expect(earned).to.be.eq( await CDTContract.balanceOf(user.address));
    });
    it("can withdraw", async () => {
        const stakingRewards: StakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, user);
        const CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, user);
        await CDTContract.approve(stakingRewards.address, ethers.utils.parseEther("10000000"));
        await stakingRewards.stake(ethers.utils.parseEther("1"));
        //clear balance
        await CDTContract.transfer(treasury.address, await CDTContract.balanceOf(user.address));
        await advanceTime(DAY * 30);
        await stakingRewards.withdraw(ethers.utils.parseEther("1"));
        expect(await CDTContract.balanceOf(user.address)).to.be.eq(ethers.utils.parseEther("1") );
    });
    it("reward is proportional to amount staked", async () => {
        let stakingRewards: StakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, treasury);
        let CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, treasury);
        await CDTContract.transfer(stakingRewards.address, ethers.utils.parseEther("100"));
        await stakingRewards.startRewards(ethers.utils.parseEther("100"), DAY * 30);
        stakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, user);
        CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, user);
        await CDTContract.approve(stakingRewards.address, ethers.utils.parseEther("10000000"));
        await stakingRewards.stake(ethers.utils.parseEther("1"));
        //clear balance of user for easier math
        await CDTContract.transfer(treasury.address, await CDTContract.balanceOf(user.address));
        //user 2
        stakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, user2);
        CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, user2);
        await CDTContract.approve(stakingRewards.address, ethers.utils.parseEther("10000000"));
        await stakingRewards.stake(ethers.utils.parseEther("3"));
        //clear balance of user for easier math
        await CDTContract.transfer(treasury.address, await CDTContract.balanceOf(user2.address));

        await advanceTime(DAY * 31);
        let earned = await stakingRewards.earned(user.address);
        expect(earned).to.be.closeTo( ethers.utils.parseEther("25"), TOLERANCE_FOR_TESTS);
        earned = await stakingRewards.earned(user2.address);
        expect(earned).to.be.gt( ethers.utils.parseEther("74"));
        expect(earned).to.be.lt( ethers.utils.parseEther("75"));

    });
    it("rewards end when period concludes", async () => {
        let stakingRewards: StakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, treasury);
        let CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, treasury);
        await CDTContract.transfer(stakingRewards.address, ethers.utils.parseEther("100"));
        await stakingRewards.startRewards(ethers.utils.parseEther("100"), DAY * 30);
        stakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, user);
        CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, user);
        await CDTContract.approve(stakingRewards.address, ethers.utils.parseEther("10000000"));
        await stakingRewards.stake(ethers.utils.parseEther("1"));
        //clear balance of user for easier math
        await CDTContract.transfer(treasury.address, await CDTContract.balanceOf(user.address));
        await advanceTime(DAY * 31);
        let earned = await stakingRewards.earned(user.address);
        expect(earned).to.be.closeTo( ethers.utils.parseEther("100"), TOLERANCE_FOR_TESTS);
        await advanceTime(DAY * 31);
        let earned2 = await stakingRewards.earned(user.address);
        expect(earned2).to.be.eq(earned);
    });
    it("can stake before farming starts", async () => {
        let stakingRewards: StakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, treasury);
        let CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, treasury);
        await CDTContract.transfer(stakingRewards.address, ethers.utils.parseEther("100"));
        stakingRewards = StakingRewards__factory.connect(fixtureAddress.STAKING_REWARDS, user);
        CDTContract = ERC20__factory.connect(fixtureAddress.CDT_ADDRESS, user);
        await CDTContract.approve(stakingRewards.address, ethers.utils.parseEther("10000000"));
        await stakingRewards.stake(ethers.utils.parseEther("1"));
        expect(await stakingRewards.totalSupply()).to.be.eq(ethers.utils.parseEther("1"));
    });

    async function print(stakingRewards: StakingRewards) {
        console.log("rewardPerTokenStored " + (await stakingRewards.rewardPerTokenStored()).toString());
        console.log("rewardRate " + (await stakingRewards.rewardRate()).toString());
        console.log("periodFinish " + (await stakingRewards.periodFinish()).toString());
        console.log("rewardsDuration " + (await stakingRewards.rewardsDuration()).toString());
        const totalSupply = await stakingRewards.totalSupply();
        console.log("totalSupply " + ethers.utils.formatEther(totalSupply));
        let rewardD = await stakingRewards.getRewardForDuration();
        console.log("reward for duration " + ethers.utils.formatEther(rewardD));
    }
});
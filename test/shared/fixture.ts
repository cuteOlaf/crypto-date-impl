
import { ethers } from "hardhat";
import { deployContract } from 'ethereum-waffle'
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Contract } from "ethers";
import { CryptoDate } from "../../typechain";
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Router02 from '@uniswap/v2-periphery/build/UniswapV2Router02.json'
import { StakingRewards } from "../../typechain/StakingRewards";
import { StakingRewards__factory } from "../../typechain/factories/StakingRewards__factory";
import { CryptoDate__factory } from "../../typechain/factories/CryptoDate__factory";
import { resetBlockToZero, DAY, sleep } from "./helpers";
import { CryptoDateToken } from "../../typechain/CryptoDateToken";
import { CryptoDateToken__factory } from "../../typechain/factories/CryptoDateToken__factory";
import { Legacy } from "../../typechain/Legacy";
import { Legacy__factory } from "../../typechain/factories/Legacy__factory";
let CDT: CryptoDateToken;
let WETH: Contract;
let factoryV2: Contract;
let router02: Contract;
let CDT_WETH_PAIR: Contract;
let cryptoDate: CryptoDate;
let liquidityRewards: StakingRewards;
let stakingRewards: StakingRewards;
let operations: SignerWithAddress;
let user: SignerWithAddress;
let treasury: SignerWithAddress;
let user2: SignerWithAddress;
let legacyMapping: Legacy;
// these are the actual amounts of ERC20 tokens used in the production contracts
const INIT_CDT = ethers.utils.parseEther("50205000"); //total 50,205,000 - bump to fund liquidity pool
const CDT_FOR_NFT_REWARDS = ethers.utils.parseEther("22911000");// 22,774,500
const CDT_FOR_TREASURY = ethers.utils.parseEther("2921000"); //2,921,000 

// these proportions snap to 1 ETH = 2000 DAI or 2000 CDT
const CDT_INITIAL_LIQUIDITY = ethers.utils.parseEther("10000");
const WETH_CDT_INITIAL_LIQUIDITY = ethers.utils.parseEther("5");

export interface FixtureAddresses {
    CDT_ADDRESS: string
    WETH_ADDRESS: string
    CDT_WETH_PAIR_ADDRESS: string
    FACTORY: string
    ROUTER: string
    CRYPTO_DATE_NFT_ADDRESS: string
    STAKING_REWARDS: string
    LIQUIDITY_REWARDS: string
    LEGACY_MAPPING: string
  }
  //allow token amounts locked in smart contract to be passed in for different test cases
export async function deployFixture(cdtForNFTRewards:BigNumber = CDT_FOR_NFT_REWARDS): Promise<FixtureAddresses> {
    // make sure we are always at block zero for each test
    await resetBlockToZero();
    [operations, user, treasury, user2] = await ethers.getSigners();
    //deploy ERC20s
    const cryptoDateTokenFactory: CryptoDateToken__factory = new CryptoDateToken__factory(operations);
    //chip in the initial cdt liquidity since the operations contract will use that before the treasury gets tokens
    CDT = await cryptoDateTokenFactory.deploy(INIT_CDT.add(CDT_INITIAL_LIQUIDITY)); 
    WETH = await deployContract(operations, WETH9);
    //convert some eth to weth
    WETH.deposit({ value: ethers.utils.parseEther("10") });
    // deploy V2 factory and router
    factoryV2 = await deployContract(operations, UniswapV2Factory, [operations.address]);
    router02 = await deployContract(operations, UniswapV2Router02, [factoryV2.address, WETH.address]);
    // make CDT_WETH pool    
    await factoryV2.createPair(WETH.address, CDT.address);
    const CDT_WETH_PAIR_ADDRESS = await factoryV2.getPair(WETH.address, CDT.address);
    CDT_WETH_PAIR = new Contract(CDT_WETH_PAIR_ADDRESS, JSON.stringify(IUniswapV2Pair.abi), ethers.provider).connect(operations);
    await CDT.transfer(CDT_WETH_PAIR_ADDRESS, CDT_INITIAL_LIQUIDITY);
    await WETH.transfer(CDT_WETH_PAIR_ADDRESS, WETH_CDT_INITIAL_LIQUIDITY)
    await CDT_WETH_PAIR.mint(operations.address)

    //make legacy addresses
    const legacyFactory = new Legacy__factory(operations);
    legacyMapping = await legacyFactory.deploy();

    //make NFT contract
    const cryptoDateFactory: CryptoDate__factory = new CryptoDate__factory(operations);
    cryptoDate = await cryptoDateFactory.deploy (
        CDT.address,
        router02.address,
        WETH.address,
        CDT_WETH_PAIR.address,
        treasury.address,
        legacyMapping.address);
    await cryptoDate.deployed();
    //fund nft contract with CDT for farming
    await CDT.transfer(cryptoDate.address, cdtForNFTRewards);
    //fund treasury
    await CDT.transfer(treasury.address, CDT_FOR_TREASURY);
    //use treasury for bootstrapping users
    const treasuryCDT = CryptoDateToken__factory.connect(CDT.address, treasury);

    //fund users with CDT for purchasing, farming and staking
    await treasuryCDT.transfer(user.address, ethers.utils.parseEther("10000"));
    await treasuryCDT.transfer(user2.address, ethers.utils.parseEther("10000"));

    //make the two rewards contracts
    const stakingRewardsFactory: StakingRewards__factory = new StakingRewards__factory(operations);
    liquidityRewards = await stakingRewardsFactory.deploy(
         CDT.address, CDT_WETH_PAIR.address);
    stakingRewards = await stakingRewardsFactory.deploy(
       CDT.address, CDT.address
    );    

    return {
        CDT_ADDRESS: CDT.address,
        WETH_ADDRESS: WETH.address,
        CDT_WETH_PAIR_ADDRESS: CDT_WETH_PAIR.address,
        FACTORY: factoryV2.address,
        ROUTER: router02.address,
        CRYPTO_DATE_NFT_ADDRESS: cryptoDate.address,
        STAKING_REWARDS: stakingRewards.address,
        LEGACY_MAPPING: legacyMapping.address,
        LIQUIDITY_REWARDS: liquidityRewards.address
    };
}

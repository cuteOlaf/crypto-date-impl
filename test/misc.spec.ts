import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import chai from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { CryptoDate, CryptoDate__factory, ERC20__factory } from "../typechain";
import { deployFixture, FixtureAddresses } from "./shared/fixture";
import { Legacy__factory } from "../typechain/factories/Legacy__factory";
import { Legacy } from "../typechain/Legacy";
chai.use(solidity);
const { expect } = chai;

describe("Misc Tests", async () => {
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
  it("can check legacy address", async () => {
    const legacy: Legacy = Legacy__factory.connect(fixtureAddress.LEGACY_MAPPING, user);
    const owner = await legacy.owners(19720210);
    expect(owner).to.be.eq("0xDcae967431FB51aa7453EC6C06fA544C25e0f1ff");

  });
  it("cannot withdraw reward token", async () => {
    const cryptoDate: CryptoDate = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, user);
    await expect(cryptoDate.recoverWrongTokens(fixtureAddress.CDT_ADDRESS, ethers.utils.parseEther("1"))).to.be.revertedWith("Cannot be reward token");

  });
  
  it("anyone can withdraw eth", async () => {
    let cryptoDateInstance = CryptoDate__factory.connect(fixtureAddress.CRYPTO_DATE_NFT_ADDRESS, operations);
    await user.sendTransaction({
      to: cryptoDateInstance.address,
      value: ethers.utils.parseEther("1.0")
    });
    let balContract = await ethers.provider.getBalance(cryptoDateInstance.address);
    expect(balContract).to.equal(ethers.utils.parseEther("1.0"));
    
    await cryptoDateInstance.withdrawETH(balContract);
    let balContractAfter = await ethers.provider.getBalance(cryptoDateInstance.address);
    expect(balContractAfter).to.equal(0);

  });

});

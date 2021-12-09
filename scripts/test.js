import { expect } from "chai";
import { CPO, COUNTERV1, COUNTERV2, TRANSPARENT_PROXY } from "./constants.js";
import { ethers } from "ethers";

// Can't find a way to test everything in dapp
// So there's a JS file lol
// https://forum.openzeppelin.com/t/selfdestruct-and-redeploy-in-the-same-transaction-using-create2-fails/8797
describe("CPO", function () {
  let ganache;
  let provider;
  let signer;
  let signerAddress;

  let Cpo;
  let GenericProxy;
  let logic1;
  let logic2;

  before(async function () {
    provider = new ethers.providers.JsonRpcProvider();
    signer = await provider.getSigner();
    signerAddress = await signer.getAddress();

    // OZ Generic proxy
    GenericProxy = new ethers.ContractFactory(
      TRANSPARENT_PROXY.abi.map(({ constant, ...x }) => x),
      TRANSPARENT_PROXY["bin"],
      signer
    );

    // Some stupid "constant" thing, filter out constant field in abi output
    // Not sure wtf
    Cpo = new ethers.ContractFactory(
      CPO.abi.map(({ constant, ...x }) => x),
      CPO["bin"],
      signer
    );
    logic1 = await new ethers.ContractFactory(
      COUNTERV1.abi.map(({ constant, ...x }) => x),
      COUNTERV1["bin"],
      signer
    ).deploy();
    logic2 = await new ethers.ContractFactory(
      COUNTERV2.abi.map(({ constant, ...x }) => x),
      COUNTERV2["bin"],
      signer
    ).deploy();
  });

  it("Upgradability", async function () {
    // Deploy CPO
    const cpo = await Cpo.deploy(signerAddress);

    // Do some tests
    const name = "feet";
    const salt =
      "0x000000000000000000000000000000000000000000000000000000000000f337";
    const initCodeHash = await cpo.proxyInitCodeHash(name);

    // Deterministic address creation
    const expectedProxyAddress = ethers.utils.getCreate2Address(
      cpo.address,
      salt,
      initCodeHash
    );
    await cpo.createProxy(name, salt, logic1.address);
    const proxyAddress = await cpo.proxies(name);
    expect(proxyAddress === expectedProxyAddress).to.be.true;

    // Check out the logic
    const ver1 = await logic1.attach(proxyAddress).version();
    expect(ver1 === "v1").to.be.true;

    // Upgrade
    await cpo.destroyProxy(name);
    await cpo.createProxy(name, salt, logic2.address);

    // Upgrade and check
    const ver2 = await logic1.attach(proxyAddress).version();
    expect(ver2 === "v2").to.be.true;
  });

  it("Compare gas used", async function () {
    const gProxy = await GenericProxy.deploy(
      logic1.address,
      logic1.address,
      "0x"
    );

    // Generic proxy
    const val1 = await logic1.attach(gProxy.address).callStatic.value();
    await logic1.attach(gProxy.address).reset();
    const tx1 = await logic1
      .attach(gProxy.address)
      .increase()
      .then((x) => x.wait());
    const val2 = await logic1.attach(gProxy.address).callStatic.value();
    expect(val1.eq(0)).to.be.true;
    expect(val2.gt(val1)).to.be.true;

    // cpo proxy
    const cpo = await Cpo.deploy(signerAddress);
    await cpo.createProxy("feet", ethers.constants.HashZero, logic2.address);
    const cpoProxy = await cpo.callStatic.implementations("feet");
    await logic2.attach(cpoProxy).reset();
    const val3 = await logic2.attach(cpoProxy).callStatic.value();
    const tx2 = await logic2
      .attach(cpoProxy)
      .increase()
      .then((x) => x.wait());
    const val4 = await logic2.attach(cpoProxy).callStatic.value();
    expect(val3.eq(0)).to.be.true;
    expect(val4.gt(val3)).to.be.true;

    // Base cases
    await logic1.reset();
    await logic2.reset();

    const baseTx1 = await logic1.increase().then((x) => x.wait());
    const baseTx2 = await logic2.increase().then((x) => x.wait());

    expect(baseTx2.gasUsed.eq(baseTx1.gasUsed)).to.be.true;

    console.log(
      "gas used for generic proxy increased by",
      tx1.gasUsed.sub(baseTx1.gasUsed).toString()
    );

    console.log(
      "gas used for cpo proxy increased by",
      tx2.gasUsed.sub(baseTx2.gasUsed).toString()
    );
  });
});

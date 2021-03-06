import EthereumService from "./Ethereum";
import EtherscanService from "./Etherscan";
import BlockService from "./Block";
import TokenService from "./Token";
import TwitterService from "./Twitter";
import TheGraph from "./TheGraph";

class BlockProcessorService {
  static async processIncomingBlocks() {
    const lastProcessedBlockNumber = await BlockService.getLastSavedBlockNumber();

    let blockNumberToProcess = parseInt(lastProcessedBlockNumber) + 1;

    let blockHasBeenMined = await EthereumService.blockHasBeenMined(blockNumberToProcess);

    if (!blockHasBeenMined) {
      console.log("Did not process any blocks");
    }

    while (blockHasBeenMined) {
      await BlockService.createBlock(blockNumberToProcess);

      try {
        await BlockProcessorService.processBlock(blockNumberToProcess);
        await BlockService.markAsProcessed(blockNumberToProcess);
        console.log(`Processed block #${blockNumberToProcess}`);
      } catch (err) {
        // TODO: log block processing errors
        console.log(err);
      }

      blockNumberToProcess++;

      blockHasBeenMined = await EthereumService.blockHasBeenMined(blockNumberToProcess);
    }
  }

  static async processBlock(blockNumber) {
    const logs = await EtherscanService.getTransferLogsForBlock(blockNumber);

    if (!logs) {
      return;
    }

    for (const log of logs) {
      const [_, __, encodedToAddress, encodedTokenId] = log.topics;

      const toAddress = EthereumService.decodeAddress(encodedToAddress);
      const tokenId = EthereumService.decodeInt(encodedTokenId);

      await TokenService.save({
        ownerAddress: toAddress,
        transactionHash: log.transactionHash,
        tokenId: parseInt(tokenId),
      });

      const data = await TheGraph.getMediaById(parseInt(tokenId));

      console.log(data);

      await TwitterService.sendTweet(data);
    }
  }
}

export default BlockProcessorService;

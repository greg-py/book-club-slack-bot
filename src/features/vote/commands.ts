import { App } from "@slack/bolt";
import { withErrorHandling } from "../../utils";
import {
  validateVotingPrerequisites,
  validateActiveCycleExists,
  validateCyclePhase,
} from "../../validators";
import { CyclePhase } from "../../constants";
import { Suggestion } from "../../services";
import { sendVoteUI, sendVotingResultsUI } from "./ui";

/**
 * Registers all vote commands
 * @param app - The Slack app
 */
export const registerVoteCommands = (app: App): void => {
  // Command to vote on suggestions
  app.command(
    "/chapters-vote",
    withErrorHandling(async ({ command, client }) => {
      // Validate cycle exists
      const cycle = await validateActiveCycleExists(command.channel_id);

      // Validate voting prerequisites (phase, suggestion count, user vote status)
      const suggestions = await validateVotingPrerequisites(
        cycle,
        command.user_id,
        true // Check if user has voted
      );

      await sendVoteUI(client, command, suggestions);
    })
  );

  // Command to view voting results
  app.command(
    "/chapters-voting-results",
    withErrorHandling(async ({ command, client }) => {
      // Validate cycle exists
      const cycle = await validateActiveCycleExists(command.channel_id);

      // Validate that the cycle is in a phase where voting results are meaningful
      validateCyclePhase(
        cycle,
        [CyclePhase.VOTING, CyclePhase.READING, CyclePhase.DISCUSSION],
        "results viewing"
      );

      const suggestions = await Suggestion.getAllForCycle(cycle.getId());

      await sendVotingResultsUI(client, command, suggestions);
    })
  );
};

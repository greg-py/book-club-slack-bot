import type { App } from "@slack/bolt";
import { Cycle } from "../../services";
import { withErrorHandling } from "../../utils";
import {
  validateActiveCycleExists,
  validateNoActiveCycleExists,
} from "../../validators";
import {
  sendCycleConfigurationUI,
  sendCyclePhaseSelectionUI,
  sendCycleStatusMessage,
} from "./ui";
import { CyclePhase, ActionId } from "../../constants";

/**
 * Registers all cycle commands
 * @param app - The Slack app
 */
export function registerCycleCommands(app: App): void {
  // Command to open phase configuration UI to start a new book club cycle
  app.command(
    "/chapters-start-cycle",
    withErrorHandling(async ({ command, client }) => {
      // Validate no active cycle exists
      await validateNoActiveCycleExists(command.channel_id);

      // Initializes the cycle by creating a new instance
      const cycle = await Cycle.createNew(command.channel_id);

      // Prompt user for custom cycle configuration values
      await sendCycleConfigurationUI(cycle, client, command);
    })
  );

  // Command to retrieve current active cycle information
  app.command(
    "/chapters-cycle-status",
    withErrorHandling(async ({ command, client }) => {
      // Validate active cycle exists
      const cycle = await validateActiveCycleExists(command.channel_id);

      await sendCycleStatusMessage(cycle, client, command);
    })
  );

  // Command to change the phase of the current cycle
  app.command(
    "/chapters-set-phase",
    withErrorHandling(async ({ command, client }) => {
      // Validate active cycle exists
      const cycle = await validateActiveCycleExists(command.channel_id);

      await sendCyclePhaseSelectionUI(cycle, client, command);
    })
  );

  // Command to complete and archive the current book club cycle
  app.command(
    "/chapters-complete-cycle",
    withErrorHandling(async ({ command, client }) => {
      // Validate active cycle exists
      const cycle = await validateActiveCycleExists(command.channel_id);

      // Verify the cycle is in the discussion phase
      if (cycle.getCurrentPhase() !== CyclePhase.DISCUSSION) {
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: "⚠️ A cycle can only be completed when it's in the discussion phase.",
        });
        return;
      }

      // Set the end date for the discussion phase first (while still active)
      await cycle.setCurrentPhaseEndDate();

      // Then update the cycle status to completed
      await cycle.update({ status: "completed" });

      // Send confirmation to the user
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: `✅ Book club cycle "${cycle.getName()}" has been completed and archived.`,
      });

      // Import the completion message formatter
      const { formatCycleCompletionMessage } = await import("../../utils");

      // Generate comprehensive completion message
      const completionMessage = await formatCycleCompletionMessage(cycle);

      // Post comprehensive announcement in the channel
      await client.chat.postMessage({
        channel: command.channel_id,
        text: completionMessage,
      });
    })
  );

  // Command to reset/clear the current book club cycle
  app.command(
    "/chapters-reset-cycle",
    withErrorHandling(async ({ command, client }) => {
      try {
        // Validate active cycle exists first
        const cycle = await validateActiveCycleExists(command.channel_id);

        // Send a confirmation message with warning
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "⚠️ WARNING: Reset Book Club Cycle",
                emoji: true,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `You are about to *permanently delete* the current active book club cycle "*${cycle.getName()}*" in this channel.\n\nThis will:\n• Delete all book suggestions\n• Delete all votes\n• Clear phase transition timers\n• Allow starting a fresh cycle\n\n*This action cannot be undone.*`,
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Yes, Reset Everything",
                    emoji: true,
                  },
                  style: "danger",
                  confirm: {
                    title: {
                      type: "plain_text",
                      text: "Are you absolutely sure?",
                    },
                    text: {
                      type: "plain_text",
                      text: "This will permanently delete all cycle data.",
                    },
                    confirm: {
                      type: "plain_text",
                      text: "Yes, Delete Everything",
                    },
                    deny: {
                      type: "plain_text",
                      text: "Cancel",
                    },
                  },
                  action_id: ActionId.CONFIRM_CYCLE_RESET,
                },
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Cancel",
                    emoji: true,
                  },
                  action_id: ActionId.CANCEL_CYCLE_RESET,
                },
              ],
            },
          ],
          text: "Warning: You are about to reset the book club cycle",
        });
      } catch (error) {
        // If no active cycle exists, inform the user
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: "No active book club cycle to reset. Use `/chapters-start-cycle` to start a new cycle.",
        });
      }
    })
  );
}

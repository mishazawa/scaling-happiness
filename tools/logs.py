# extract.py
import re
import sys


def extract_my_messages(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()

    # Changed regex to capture the "You:" part as well
    # (^You:.*?) captures everything starting with "You:"
    pattern = re.compile(
        r"(^You:.*?)(?=^(?:Claude|You):\s*|\Z)", re.DOTALL | re.MULTILINE
    )

    for msg in pattern.findall(text):
        msg_clean = msg.strip()

        # Skip messages that contain <task-notification>
        if "<task-notification>" in msg_clean:
            continue

        # (Optional) Uncomment the next two lines if you also want to skip the interruption messages
        # if "[Request interrupted by user for tool use]" in msg_clean:
        #     continue

        # Print each message separated by a blank line
        print(msg_clean + "\n")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        extract_my_messages(sys.argv[1])

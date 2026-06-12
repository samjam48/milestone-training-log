# User Ux Assessment 12-06-2026


### Logs
- Logs page - Day and week need cleaner visible breaks. Currently there is a clear break between months but between days and weeks it reads like one long list of exercises and could be more intuitive. It doesn't need to be a a lot, something subtle like a rounded indentation of the card between each day and a small break between each week.
- Logging an exercise with minute units - Exercises whose unit is set as minutes should not show an input unit. it is just minutes again so the value is just a copy and shouldn't be shown to the user.
- Logging an exercise - After selecting the exercise type the entire section under "What did you do should snap  up like a toggle so you can just see the class and exercise, then if you chose the wrong exercise you can click on it and the toggle opens back up to choose from all exercises. It takes up so much of teh screen that currently you have to scroll down to edit any details of the actual exercise once you've selected the type.

### Log incident:
- Where are incidents ever shown? - Maybe they could show up in log history as they aren't really part of the UI else.
- Viewing what may have contributed after logging - when you log an incident you see a long list of items before confirming - this offers no real functionality as it is very long and doesn't specifcy the exercise and seems to show far more items per day than there are logs. It is quite hard to read the unintuitive long list. Also the 'Done' button on this page is very squished. I think we can clean it up for now and just show the headline status about the incident being recorded and the done button in full size, Done button shouldn't be red but instead white.

### Dashboard
- Load risk section - for daily or weekly limits - put the timeframe limit before the progress count (daily 0 / 3km), (weekly 5 / 20km)
- Activity status - In items under 'Done Today' - don't say 'Last done 0 days ago' - this message is redundant as it's in the today section, if there are other rules associated with the exercise choose one of them or share how many units logged that week.
- Clean streak - Doesn't seem to flag rule violations - is the logic here working? I'm not sure how useful this section is currently and if we could park it until we do a full streaks section that is though out or if there is something worth salvaging from this currently.

### Rules block:
- What is 'All classes'? - I am getting a rule show up called 'all classes' but no rule should apply to all classes, this is the point of having classes so they can have different rules.
- Preview Items grouping - the preview is very busy and hard to read currently - potential suggestions:
  - If several rules for the same property  - group all rules together and only have one title and then show the rules in the current way but it makes the screen less of a wall of text.
  - Exercises matched to their class - keep things grouped so that items of a class all show up in order rather than in the random order that rules were made.
- Edit rules - this section is also very busy and takes up lots of space for not much information:
  - 'i' icon for info - instead of showing the description text for every rule type just put an 'i' icon style tooltip next to the rule so you can find out more if needed.
  - settings in line and smaller - instead of dedicating and entire line to the " - <<number-input>> <<unit-selector>> + " we can have it all on the same line.
  - Toggle rule On/Off - stays the same but moves to the left of the line before the exercise title.
  - Delete is a faded red bin icon rather than a word and renders at the right of the line (this should be the same for other items with a delete option *(a log, a goal, an activity class, an exercise)*
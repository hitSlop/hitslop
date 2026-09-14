# Dark training console

Single job: work through a routine, one set at a time.

A cool charcoal Instrument with electric lime completion controls, crisp white
Barlow Condensed headings, recessed reps/load readouts, and raised set keys.
The window is the console boundary. There is no nested decorative shell.

The selected exercise leads. Individual 44px set keys toggle independently;
Log set finds the first unfinished set. A compact queue lets the user choose
any exercise. Routine editing sits behind one explicit action. The rest dock
stays visible while long content scrolls, including at 360px wide.

Completing a set starts rest. Completing an exercise keeps its result visible
until rest finishes or is skipped, then advances to the next unfinished lift.
Manual selection overrides that pending advancement. The final set ends rest
and shows completion. A completed exercise can still be selected to correct a
set. Reset requires confirmation and retains exercises, targets, and order.

Rest uses an absolute deadline and reconciles on visibility changes. It is
transient across document closure; completion is persisted. Announcements occur
at meaningful transitions, not every second. Motion uses short CSS transitions
and respects reduced motion. Export renders saved targets and final set state,
with no live timer or animation dependency.

The optional completedSetIndices field records independent completion. Legacy
completedSets means the first N sets; interaction writes indices and synchronizes
the count. Unknown properties remain intact. Target counts are displayed with
consistent bounds and only rewritten through explicit edits.

The icon is a dimensional weight plate with three grip openings and four small
completion markers. All fonts are bundled with their license.

---
type: plug
repo: https://github.com/silverbulletmd/silverbullet
---

The Tasks plug implements task support in SilverBullet.

## Task states
The tasks plug support the standard “done” and “not done” states via `[x]` and `[ ]` notation in the context of a list (this is fairly widely accepted [[Markdown]] syntax):

* [ ] This is a task (toggle me!)

However, custom states can also be used for extra flexibility:

* [TODO] This task is still to do
* [IN PROGRESS] In progress task
* [RESOLVED] A resolved task
* [-] Whatever this state means
* [/] Or this one

You can cycle through the states by clicking on the status or by running the {[Task: Cycle State]} command while on a task. There is also auto complete for all known custom task states in a space.

## Annotations
Tasks can also be annotated with [[Tags]]:

* [ ] This is a tagged task #my-tag

As well as [[Attributes]]:

* [ ] This is a task with attributes [taskAttribute: true]

## Deadlines

Tasks can specify deadlines:

* [ ] This is due 📅 2022-11-26

When the cursor is positioned inside of a due date, the {[Task: Postpone]} command can be used to postpone the task for a certain period.

## Querying
All meta data (`done` status, `state`, `tags`, `deadline` and custom attributes) is extracted and available via the `task` query source to [[Query]]:

<!-- #query task where page = "{{@page.name}}" -->
|name                          |done |state      |page    |pos |tags  |taskAttribute|deadline  |
|--|--|--|--|--|--|--|--|
|Remote toggle me              |false|           |🔌 Tasks|3056|      |    |          |
|This is a task (toggle me!)   |false|           |🔌 Tasks|321 |      |    |          |
|This task is still to do      |false|TODO       |🔌 Tasks|420 |      |    |          |
|In progress task              |false|IN PROGRESS|🔌 Tasks|454 |      |    |          |
|A resolved task               |false|RESOLVED   |🔌 Tasks|487 |      |    |          |
|Whatever this state means     |false|-          |🔌 Tasks|516 |      |    |          |
|Or this one                   |false|/          |🔌 Tasks|548 |      |    |          |
|This is a tagged task #my-tag |false|           |🔌 Tasks|824 |my-tag|    |          |
|This is a task with attributes|false|           |🔌 Tasks|889 |      |true|          |
|This is due                   |false|           |🔌 Tasks|993 |      |    |2022-11-26|
<!-- /query -->

## Rendering
There is a [[!silverbullet.md/template/task]] template you can use to render tasks nicely rather than using the default table (as demonstrated above). When you use this template, you can even cycle through the states of the task by click on its state _inside_ the rendered query, and it will update the state of the _original_ task automatically (although not yet in reverse) — this works across pages.

Try it (by clicking on the checkbox inside of the directive):

<!-- #query task where page = "{{@page.name}}" and name = "Remote toggle me" render [[template/task]] -->
* [ ] [[🔌 Tasks@3056]] Remote toggle me
<!-- /query -->

* [ ] Remote toggle me

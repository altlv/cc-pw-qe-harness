# Exploratory testing charters

Scripted tests check what someone already thought of. Exploratory testing finds
what nobody did. It is structured work, not clicking around — the structure is the
charter and the notes.

## Charter format

```
Explore    <area>
With       <resources: data, tools, personas, network conditions>
To discover <what class of information you are hunting>
Timebox    <25 / 45 / 90 minutes>
```

Worked example:

```
Explore    the countdown timer's behaviour at and past zero
With       durations of 0, 1, negative, and non-numeric values
To discover whether the timer can be driven into an inconsistent state
Timebox    45 minutes
```

## During the session

Keep a running log of three things, separated: **observations** (what happened),
**questions** (what looked odd but unconfirmed), **bugs** (reproducible). Mixing
them turns the notes into an opinion.

Note setup and timing — a defect you cannot reproduce is a rumour.

## After the session

Produce: bugs raised, areas covered, areas _not_ reached, and new automated tests
worth adding. A charter that yields no candidate regression tests probably explored
somewhere already well covered.

## Oracles

An oracle is how you decide something is wrong. Name which one you are using, since
"looks fine" is not one:

- **Consistency with itself** — the same action gives the same result
- **Consistency with comparable products** — other timers behave this way
- **Consistency with claims** — the documentation or story says so
- **Consistency with the user's purpose** — technically correct, still useless

When no oracle applies, the honest output is a question for the product owner, not
a passing test.

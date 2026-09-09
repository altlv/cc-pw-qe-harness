# Test data probes

Specific values to try, by field type. `test-design` tells you _which_ fields deserve
attention; this says _what to put in them_.

Bundled with the skill deliberately — a skill that points at a reference it does not
ship with is a skill that stops working when the reference goes missing.

**Do not use every probe on every field.** High-risk fields (auth, money, personal
data, anything that crosses a trust boundary) get the full set. Low-risk fields get a
representative sample. A test suite that probes every field exhaustively is slow and
nobody runs it.

## Numeric

| Probe                   | Value          | Catches                                           |
| ----------------------- | -------------- | ------------------------------------------------- |
| Zero                    | `0`            | Division by zero, falsy checks, "unset" confusion |
| Negative                | `-1`           | Sign handling, unsigned wraparound                |
| Integer max             | `2147483647`   | Overflow, storage limits                          |
| One past max            | `2147483648`   | Silent truncation                                 |
| Float into an int field | `3.14`         | Coercion, rounding                                |
| Numeric string          | `"123"`        | Implicit conversion, loose equality               |
| Very large              | `999999999999` | Display truncation, precision loss                |
| Null / empty            | `null`, `""`   | Required-field validation                         |

## String

| Probe                  | Value                       | Catches                                    |
| ---------------------- | --------------------------- | ------------------------------------------ |
| Empty                  | `""`                        | Required validation                        |
| Single char            | `"a"`                       | Minimum length                             |
| Very long              | 1000+ chars                 | Truncation, layout breakage, column limits |
| Apostrophe             | `O'Brien`                   | Escaping, SQL injection                    |
| Unicode / emoji        | `🚀漢字éñ`                  | Encoding, byte-vs-char length, collation   |
| HTML                   | `<script>alert(1)</script>` | XSS, output escaping                       |
| SQL                    | `' OR 1=1 --`               | Parameterisation gaps                      |
| Null byte              | `\0`                        | String termination, binary handling        |
| Whitespace only        | `"   "`                     | Trim validation, "looks empty but isn't"   |
| Leading/trailing space | `" name "`                  | Silent trimming that breaks equality later |

## Date and time

| Probe             | Value                                    | Catches                                     |
| ----------------- | ---------------------------------------- | ------------------------------------------- |
| Non-leap Feb 29   | `2023-02-29`                             | Leap-year validation                        |
| Ambiguous format  | `02/03/2024`                             | Locale parsing — is that March or February? |
| Far future        | `9999-12-31`                             | Range limits, display                       |
| Invalid           | `2024-13-32`                             | Month/day validation                        |
| Epoch             | `1970-01-01`                             | Offset and "unset" confusion                |
| DST boundary      | 02:30 on a spring-forward date           | A time that does not exist locally          |
| Timezone crossing | Same instant either side of midnight UTC | Off-by-one-day bugs                         |

In this harness, reach these with `page.clock` rather than waiting or faking data —
see `../../pwtest/patterns/ui-test.md`.

## Email, phone, formatted

| Probe                | Value                   | Catches                                     |
| -------------------- | ----------------------- | ------------------------------------------- |
| No TLD               | `user@domain`           | Regex strictness                            |
| Empty local part     | `@domain.com`           | Format validation                           |
| Very long local part | 100 chars + `@test.com` | Length limits                               |
| Plus addressing      | `user+tag@test.com`     | Over-strict validation rejecting valid mail |
| International        | `+371-12345678`         | Country codes, separators                   |

## JSON and API payloads

| Probe                       | Value                        | Catches                                           |
| --------------------------- | ---------------------------- | ------------------------------------------------- |
| Extra field                 | `{"name":"x","unknown":"y"}` | Strict vs permissive parsing                      |
| Missing required field      | omit it entirely             | Validation, and whether the error names the field |
| Wrong type                  | `{"age":"twenty"}`           | Deserialisation, coercion                         |
| Deep nesting                | 100+ levels                  | Recursion limits, stack overflow                  |
| Empty object                | `{}`                         | Minimum payload                                   |
| Array where object expected | `[1,2,3]`                    | Type confusion                                    |
| Duplicate keys              | `{"a":1,"a":2}`              | Last-wins vs error                                |

## Collections and cardinality

Zero · one · many · maximum · one past maximum · duplicates · order reversed.

Cardinality bugs are among the most common and least tested. "Zero" and "exactly one"
break different code paths than "several", and pagination almost always breaks at
exactly the page size.

## Identity and reference

Non-existent id · id belonging to another user or tenant · deleted id · id of the
wrong type of thing · your own id where someone else's is expected.

The cross-tenant probe is the one that finds authorisation bugs. It is worth running
on anything that takes an id from the client.

_Recreated from the QA Context Model's test-data-probes reference card, extended with
timezone/DST, collection cardinality and identity probes._

# Adding New Message Types

Before adding a new message type, you should study the [packages documentation](/development/packages.md) and the source code for an existing package that handles a message type. The [Vote](https://github.com/soapdog/patchfox/tree/master/ui/packages/vote) package, which handles _likes_, is the simplest place to start.

The `messageTypes` array in the `patchfox.package()` declaration signals the handling of a message type. Each item in `messageTypes` includes a _message type_ field and a _card view_. On startup, Patchfox assembles the data from all loaded packages into a large array. When it needs to render a message, it iterates through that array, checking to see which _card view_ from which package can handle the given type.

> The order of the imports in `ui/packages/packages.js` matters because Patchfox will append them to the _message type handler array_ in the same order. If two packages handle the same type, Patchfox will use the package that comes **first** in the array. For this reason, you don't need to delete any code from the Patchfox source tree when experimenting with a new _message type handler_. You can simply move its package above the current handler in `packages.js`.

## The `messageTypes` array

A package can declare itself the handler for as many message types as it wants. Each message type needs to be an individual object inside the `messageTypes` array. Let's look at the package declaration for the `Vote` package.

```
const VoteView = require("./Vote.js")

patchfox.package({
    name: "vote",
    messageTypes: [
        {
            type: "vote",
            card: VoteView,
            short: true
        }
    ]
})
```

* `type` is a string that represents the message type. It will be matched against incoming messages.
* `card` tells Patchfox which Mithril component to use to render the message.
* `short` is a boolean value that determines the styling of the card. `true` causes Patchfox to display a short card with no background, and `false` displays as a normal card.

There is another field that is not represented in the above example. `validator` is a function that can be run to further refine the match. If the `type` matches and a `validator` function is present, the card will only be used if `validator` returns `true`. This is because there are some message types that are _overloaded_ in SSB. An example is the `about` message type, which might refer to a _profile being updated_ or a _gathering being updated_, or one of many other actions.

For example, the `calendar` package declares itself the handler for `about` message types, but uses a validator to trap only _gatherings_.

```
const { isUpdate } = require("ssb-gathering-schema")

{
    type: "about",
    card: GatheringActionCard,
    validator: msg => {
        return isUpdate(msg)
    }
}
```

## Summary: Steps to add a new message type

1. Find out which package should handle that message type. Maybe you don't need to create a new package.
2. Create the Mithril component to handle displaying the message type.
3. Add that view with a new entry to the `messageTypes` for the package.
4. If you ended up coding a new package, remember to add it to `ui/packages/packages.js`

const { 
  Menu, 
  app, 
  dialog, 
  shell, 
  protocol, 
  BrowserWindow,
  Tray,
  ipcMain } = require("electron")
const path = require("path")
const defaultMenu = require("electron-default-menu")
const windowStateKeeper = require("electron-window-state")
const { startDefaultPatchfoxServer } = require("./server/server.js")
const queryString = require("query-string")

let windows = new Set()
let sbot = null
let tray = null

const createWindow = (data = false, windowState = false) => {
  let win

  console.log("data", data)

  if (!windowState) {
    // Create the browser window.
    win = new BrowserWindow({
      width: 800,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    })
  } else {
    win = new BrowserWindow({
      x: windowState.x,
      y: windowState.y,
      show: false,
      width: windowState.width,
      height: windowState.height,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    })

    windowState.manage(win)
  }

  windows.add(win)

  win.on("closed", () => {
    windows.delete(win)
    win = null
  })

  win.on("focus", () => {
    win.webContents.send("window:focus")
  })

  win.once("ready-to-show", () => {
    win.show()
  })

  win.webContents.on("will-navigate", (event, url) => {
    console.log("event", event)
    console.log("url", url)
  })

  // and load the index.html of the app.
  if (data?.url) {
    win.loadURL(data.url)
  } else if (data?.pkg) {
    let state = { pkg: data.pkg, view: data.view, ...data }
    let qs = queryString.stringify(state)
    let url = `file://${__dirname}/ui/index.html?${qs}`
    console.log(url)
    win.loadURL(url)
  } else {
    let url = `file://${__dirname}/ui/index.html`
    console.log(url)
    win.loadURL(url)
  }

  // Open the DevTools.
  // win.webContents.openDevTools()

  win.webContents.setWindowOpenHandler(details => {
    if (details.url.startsWith("file:")) {
      createWindow({ url: details.url })
      return { action: "deny" }
    } else {
      shell.openExternal(details.url)
      return { action: "deny" }
    }
  })
}

ipcMain.on("new-patchfox-window", (event, data) => {
  createWindow(data)
})

ipcMain.on("window:set-title", (event, data) => {
  let win = BrowserWindow.fromWebContents(event.sender)
  data = data.replace(/\w\S*/g, w => w.replace(/^\w/, c => c.toUpperCase()))
  win.setTitle(data)
})

ipcMain.on("menu:set", (event, group) => {
  // console.log("received menu", JSON.stringify(group, null, 2))
  const menu = defaultMenu(app, shell)
  let newMenus = []
  let keys = Object.keys(group)

  // console.log(JSON.stringify(menu,null,2))

  const makeSubmenu = subgroup => {
    let toPush = []
    subgroup.forEach(m => {
      m.items.forEach(i => {
        let m = {
          label: i.label,
          click: (item, win) => {
            win.webContents.send("menu:trigger", {
              event: i.event,
              data: i.data,
            })
          },
        }

        if (i?.shortcut) {
          m.accelerator = i.shortcut
        }

        toPush.push(m)
      })
      toPush.push({ type: "separator" })
    })
    toPush.pop()
    return toPush
  }

  keys.forEach(k => {
    let m = {
      label: k,
      submenu: makeSubmenu(group[k]),
    }

    if (k.toLowerCase() == "help") {
      m.role = "help"
    }

    newMenus.push(m)
  })

  // FIXME: menu has wrong order for toplevel items.
  let fileMenu = {
    label: "File",
    role: "file",
    submenu: [
      {
        label: "New Window",
        accelerator: "CmdOrCtrl+Shift+N",
        click: () => {
          createWindow()
        },
      },
      {
        role: "shareMenu"
      }
    ],
  }

  let helpMenu = newMenus.pop()

  menu.splice(1, 0, fileMenu)
  menu.splice(3, 0, ...newMenus)

  menu.pop() // get rid of original help menu.

  menu.push(helpMenu) // insert our own help menu.

  let patchfoxMenuIndex = menu.findIndex(e => e.label == "Application")

  let patchfoxMenu = menu[patchfoxMenuIndex].submenu
  let appMenu = menu[0].submenu

  appMenu.splice(1, 0, { type: "separator" }, ...patchfoxMenu)

  menu[0].submenu = appMenu
  menu.splice(patchfoxMenuIndex, 1)

  // console.log(JSON.stringify(menu, null, 2))
  let finalMenu = Menu.buildFromTemplate(menu)

  Menu.setApplicationMenu(finalMenu)
})

ipcMain.on("tray:set", (event, group) => {
  // console.log("received menu", JSON.stringify(group, null, 2))
  let menu = []
  let keys = Object.keys(group)

  // console.log(JSON.stringify(menu,null,2))

  const makeSubmenu = subgroup => {
    let toPush = []
    subgroup.forEach(m => {
      m.items.forEach(i => {
        let m = {
          label: i.label,
          click: (item, win) => {
            win.webContents.send("menu:trigger", {
              event: i.event,
              data: i.data,
            })
          },
        }

        if (i?.shortcut) {
          m.accelerator = i.shortcut
        }

        toPush.push(m)
      })
      toPush.push({ type: "separator" })
    })
    toPush.pop()
    return toPush
  }

  keys.forEach(k => {
    let m = {
      label: k,
      submenu: makeSubmenu(group[k]),
    }

    if (k.toLowerCase() == "help") {
      m.role = "help"
    }

    menu.push(m)
  })

  // FIXME: menu has wrong order for toplevel items.
  let topItems = [
    {
      label: "New Window",
      accelerator: "CmdOrCtrl+Shift+N",
      click: () => {
        createWindow()
      },
    }
  ]

  let bottomItems = [
    {
      type: "separator"
    },
    {
      label: "Quit",
      click() { app.quit() }
    }
  ]

  let finalMenu = Menu.buildFromTemplate([...topItems, ...menu, ...bottomItems])

  tray.setContextMenu(finalMenu)
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  console.log("Attempting to start server...")

  tray = new Tray(`${__dirname}/ui/assets/images/patchfox_pixel_16.png`)
  tray.setToolTip("Patchfox")

  const initialMenu = Menu.buildFromTemplate([
    {
      label: "Quit",
      click() { app.quit() }
    }
  ])
  tray.setContextMenu(initialMenu)

  startDefaultPatchfoxServer((err, ssb) => {
    console.log("Server started!", ssb.id)
    sbot = ssb

    // first-time user experience (TODO)

    // register protocol
    app.setAsDefaultProtocolClient("ssb")

    // progress checker
    let progress = ssb.progress()
    let win

    if (progress.indexes.current < progress.indexes.target) {
      win = new BrowserWindow({
        width: 400,
        height: 400,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
      })

      windows.add(win)

      win.on("closed", () => {
        windows.delete(win)
        win = null
      })

      win.loadURL(`file://${__dirname}/ui/progress.html`)

      const checkProgress = () => {
        let progress = ssb.progress()

        if (progress.indexes.current < progress.indexes.target) {
          console.log("sending progress", progress)
          win.webContents.send("progress", progress)
          setTimeout(checkProgress, 1000)
        } else {
          let mainWindowState = windowStateKeeper({
            defaultWidth: 800,
            defaultHeight: 600,
          })

          createWindow(null, mainWindowState)
        }
      }

      setTimeout(checkProgress, 1000)

      return
    }

    // main window
    let mainWindowState = windowStateKeeper({
      defaultWidth: 800,
      defaultHeight: 600,
    })

    createWindow(null, mainWindowState)
  })
})

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("will-quit", () => {
  console.log("Quitting SSB server.")
  sbot.close()
})

app.on("activate", () => {
  // On OS X it"s common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (sbot && BrowserWindow.getAllWindows().length === 0) {
    let mainWindowState = windowStateKeeper({
      defaultWidth: 800,
      defaultHeight: 600,
    })

    createWindow(null, mainWindowState)
  }
})

app.on("open-url", (event, url) => {
  event.preventDefault()
  console.log("urll", url)
  if (sbot) {
    createWindow({ pkg: "intercep", view: "view", query: url })
  } else {
    setTimeout(() => {
      createWindow({ pkg: "intercep", view: "view", query: url })
    },2000)
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and import them here.
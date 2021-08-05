import React, { useState, useEffect, useRef, useReducer } from 'react' // eslint-disable-line
import { FileExplorer, MenuItems } from '@remix-ui/file-explorer' // eslint-disable-line
import './remix-ui-workspace.css'
import { ModalDialog } from '@remix-ui/modal-dialog' // eslint-disable-line
import { Toaster } from '@remix-ui/toaster' // eslint-disable-line
import { WorkspaceProps, WorkspaceState, Modal } from './types'
import { initWorkspace } from './actions/workspace'
import { browserReducer, browserInitialState } from './reducers/workspace'

const canUpload = window.File || window.FileReader || window.FileList || window.Blob

export function Workspace (props: WorkspaceProps) {
  const LOCALHOST = ' - connect to localhost - '
  const NO_WORKSPACE = ' - none - '
  const [state, setState] = useState<WorkspaceState>({
    workspaces: [],
    reset: false,
    hideRemixdExplorer: true,
    displayNewFile: false,
    externalUploads: null,
    uploadFileEvent: null,
    loadingLocalhost: false,
    toasterMsg: ''
  })
  const [modal, setModal] = useState<Modal>({
    hide: true,
    title: '',
    message: null,
    okLabel: '',
    okFn: () => {},
    cancelLabel: '',
    cancelFn: () => {},
    handleHide: null
  })
  const [currentWorkspace, setCurrentWorkspace] = useState<string>(NO_WORKSPACE)
  const [fs, dispatch] = useReducer(browserReducer, browserInitialState)

  useEffect(() => {
    initWorkspace(props.plugin)(dispatch)
  }, [])

  useEffect(() => {
    if (fs.browser.currentWorkspace) setCurrentWorkspace(fs.browser.currentWorkspace)
  }, [fs.browser.currentWorkspace])

  props.plugin.resetNewFile = () => {
    setState(prevState => {
      return { ...prevState, displayNewFile: !state.displayNewFile }
    })
  }

  /* implement an external API, consumed by the parent */
  props.plugin.request.createWorkspace = () => {
    return createWorkspace()
  }

  props.plugin.request.setWorkspace = (workspaceName) => {
    return setWorkspace(workspaceName)
  }

  props.plugin.request.createNewFile = async () => {
    if (!state.workspaces.length) await createNewWorkspace('default_workspace')
    props.plugin.resetNewFile()
  }

  props.plugin.request.uploadFile = async (target: EventTarget & HTMLInputElement) => {
    if (!state.workspaces.length) await createNewWorkspace('default_workspace')

    setState(prevState => {
      return { ...prevState, uploadFileEvent: target }
    })
  }

  props.plugin.request.getCurrentWorkspace = () => {
    return { name: currentWorkspace, isLocalhost: currentWorkspace === LOCALHOST, absolutePath: `${props.plugin.workspace.workspacesPath}/${currentWorkspace}` }
  }

  const localhostDisconnect = () => {
    if (currentWorkspace === LOCALHOST) setWorkspace(props.plugin.workspaces.length > 0 ? props.plugin.workspaces[0] : NO_WORKSPACE)
    // This should be removed some time after refactoring: https://github.com/ethereum/remix-project/issues/1197
    else {
      setWorkspace(currentWorkspace) // Useful to switch to last selcted workspace when remixd is disconnected
      props.plugin.fileManager.setMode('browser')
    }
  }

  const createNewWorkspace = async (workspaceName) => {
    try {
      await props.plugin.fileManager.closeAllFiles()
      await props.plugin.createWorkspace(workspaceName)
      await setWorkspace(workspaceName)
      toast('New default workspace has been created.')
    } catch (e) {
      modalMessage('Create Default Workspace', e.message)
      console.error(e)
    }
  }

  const toast = (message: string) => {
    setState(prevState => {
      return { ...prevState, toasterMsg: message }
    })
  }

  /* workspace creation, renaming and deletion */

  const renameCurrentWorkspace = () => {
    modalDialog('Rename Current Workspace', renameModalMessage(), 'OK', onFinishRenameWorkspace, '', () => {})
  }

  const createWorkspace = () => {
    modalDialog('Create Workspace', createModalMessage(), 'OK', onFinishCreateWorkspace, '', () => {})
  }

  const deleteCurrentWorkspace = () => {
    modalDialog('Delete Current Workspace', 'Are you sure to delete the current workspace?', 'OK', onFinishDeleteWorkspace, '', () => {})
  }

  const modalMessage = (title: string, body: string) => {
    setTimeout(() => { // wait for any previous modal a chance to close
      modalDialog(title, body, 'OK', () => {}, '', null)
    }, 200)
  }

  const workspaceRenameInput = useRef()
  const workspaceCreateInput = useRef()

  const onFinishRenameWorkspace = async () => {
    if (workspaceRenameInput.current === undefined) return
    // @ts-ignore: Object is possibly 'null'.
    const workspaceName = workspaceRenameInput.current.value

    try {
      await props.plugin.renameWorkspace(currentWorkspace, workspaceName)
      setWorkspace(workspaceName)
      props.plugin.workspaceRenamed({ name: workspaceName })
    } catch (e) {
      modalMessage('Rename Workspace', e.message)
      console.error(e)
    }
  }

  const onFinishCreateWorkspace = async () => {
    if (workspaceCreateInput.current === undefined) return
    // @ts-ignore: Object is possibly 'null'.
    const workspaceName = workspaceCreateInput.current.value

    try {
      await props.plugin.fileManager.closeAllFiles()
      await props.plugin.createWorkspace(workspaceName)
      await setWorkspace(workspaceName)
    } catch (e) {
      modalMessage('Create Workspace', e.message)
      console.error(e)
    }
  }

  const onFinishDeleteWorkspace = async () => {
    await props.plugin.fileManager.closeAllFiles()
    const workspacesPath = props.plugin.workspace.workspacesPath
    props.plugin.browser.remove(workspacesPath + '/' + currentWorkspace)
    const name = currentWorkspace
    setWorkspace(NO_WORKSPACE)
    props.plugin.workspaceDeleted({ name })
  }
  /** ** ****/

  const resetFocus = (reset) => {
    setState(prevState => {
      return { ...prevState, reset }
    })
  }

  const setWorkspace = async (name) => {
    await props.plugin.fileManager.closeAllFiles()
    if (name === LOCALHOST) {
      props.plugin.workspace.clearWorkspace()
    } else if (name === NO_WORKSPACE) {
      props.plugin.workspace.clearWorkspace()
    } else {
      await props.plugin.workspace.setWorkspace(name)
    }
    await props.plugin.setWorkspace({ name, isLocalhost: name === LOCALHOST }, !(name === LOCALHOST || name === NO_WORKSPACE))
    props.plugin.getWorkspaces()
    setState(prevState => {
      return { ...prevState, currentWorkspace: name }
    })
  }

  const remixdExplorer = {
    hide: async () => {
      // If 'connect to localhost' is clicked from home tab, mode is not 'localhost'
      // if (props.fileManager.mode === 'localhost') {
      await setWorkspace(NO_WORKSPACE)
      props.plugin.fileManager.setMode('browser')
      setState(prevState => {
        return { ...prevState, hideRemixdExplorer: true, loadingLocalhost: false }
      })
      // } else {
      //   // Hide spinner in file explorer
      //   setState(prevState => {
      //     return { ...prevState, loadingLocalhost: false }
      //   })
      // }
    },
    show: () => {
      props.plugin.fileManager.setMode('localhost')
      setState(prevState => {
        return { ...prevState, hideRemixdExplorer: false, loadingLocalhost: false }
      })
    },
    loading: () => {
      setState(prevState => {
        return { ...prevState, loadingLocalhost: true }
      })
    }
  }

  const handleHideModal = () => {
    setModal(prevModal => {
      return { ...prevModal, hide: true, message: null }
    })
  }

  const modalDialog = async (title: string, message: string | JSX.Element, okLabel: string, okFn: () => void, cancelLabel: string, cancelFn: () => void) => {
    await setModal(prevModal => {
      return { ...prevModal, hide: false, message, title, okLabel, okFn, cancelLabel, cancelFn, handleHide: handleHideModal }
    })
  }

  const createModalMessage = () => {
    return (
      <>
        <span>{ modal.message }</span>
        <input type="text" data-id="modalDialogCustomPromptTextCreate" defaultValue={`workspace_${Date.now()}`} ref={workspaceCreateInput} className="form-control" />
      </>
    )
  }

  const renameModalMessage = () => {
    return (
      <>
        <span>{ modal.message }</span>
        <input type="text" data-id="modalDialogCustomPromptTextRename" defaultValue={ currentWorkspace } ref={workspaceRenameInput} className="form-control" />
      </>
    )
  }

  return (
    <div className='remixui_container'>
      <ModalDialog id='workspacesModalDialog' {...modal}>
        { (typeof modal.message !== 'string') && modal.message }
      </ModalDialog>
      <Toaster message={state.toasterMsg} />
      <div className='remixui_fileexplorer' onClick={() => resetFocus(true)}>
        <div>
          <header>
            <div className="mb-2">
              <label className="form-check-label" htmlFor="workspacesSelect">
                Workspaces
              </label>
              <span className="remixui_menu">
                <span
                  id='workspaceCreate'
                  data-id='workspaceCreate'
                  onClick={(e) => {
                    e.stopPropagation()
                    createWorkspace()
                  }}
                  className='far fa-plus-square remixui_menuicon'
                  title='Create'>
                </span>
                <span
                  hidden={currentWorkspace === LOCALHOST || currentWorkspace === NO_WORKSPACE}
                  id='workspaceRename'
                  data-id='workspaceRename'
                  onClick={(e) => {
                    e.stopPropagation()
                    renameCurrentWorkspace()
                  }}
                  className='far fa-edit remixui_menuicon'
                  title='Rename'>
                </span>
                <span
                  hidden={currentWorkspace === LOCALHOST || currentWorkspace === NO_WORKSPACE}
                  id='workspaceDelete'
                  data-id='workspaceDelete'
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteCurrentWorkspace()
                  }}
                  className='fas fa-trash'
                  title='Delete'>
                </span>
              </span>
              <select id="workspacesSelect" value={currentWorkspace} data-id="workspacesSelect" onChange={(e) => setWorkspace(e.target.value)} className="form-control custom-select">
                {
                  fs.browser.workspaces
                    .map((folder, index) => {
                      return <option key={index} value={folder}>{folder}</option>
                    })
                }
                <option value={LOCALHOST}>{currentWorkspace === LOCALHOST ? 'localhost' : LOCALHOST}</option>
                { fs.browser.workspaces.length <= 0 && <option value={NO_WORKSPACE}>{NO_WORKSPACE}</option> }
              </select>
            </div>
          </header>
        </div>
        <div className='remixui_fileExplorerTree'>
          <div>
            <div className='pl-2 remixui_treeview' data-id='filePanelFileExplorerTree'>
              { state.hideRemixdExplorer && currentWorkspace && currentWorkspace !== NO_WORKSPACE && currentWorkspace !== LOCALHOST &&
                  <FileExplorer
                    name={currentWorkspace}
                    registry={props.plugin.registry}
                    filesProvider={props.plugin.workspace}
                    menuItems={['createNewFile', 'createNewFolder', 'publishToGist', canUpload ? 'uploadFile' : '']}
                    plugin={props.plugin}
                    focusRoot={state.reset}
                    contextMenuItems={props.plugin.registeredMenuItems}
                    removedContextMenuItems={props.plugin.removedMenuItems}
                    displayInput={state.displayNewFile}
                    externalUploads={state.uploadFileEvent}
                    resetFocus={resetFocus}
                  />
              }
            </div>
            {
              state.loadingLocalhost ? <div className="text-center py-5"><i className="fas fa-spinner fa-pulse fa-2x"></i></div>
                : <div className='pl-2 filesystemexplorer remixui_treeview'>
                  { !state.hideRemixdExplorer &&
                      <FileExplorer
                        name='localhost'
                        registry={props.plugin.registry}
                        filesProvider={props.plugin.localhost}
                        menuItems={['createNewFile', 'createNewFolder']}
                        plugin={props.plugin}
                        focusRoot={state.reset}
                        contextMenuItems={props.plugin.registeredMenuItems}
                        removedContextMenuItems={props.plugin.removedMenuItems}
                        resetFocus={resetFocus}
                      />
                  }
                </div>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

export default Workspace

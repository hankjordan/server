/*
 * Copyright (c) 2014
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function() {

	var TEMPLATE_FILE_ACTION_TRIGGER =
		'<a class="action action-{{nameLowerCase}}" href="#" data-action="{{name}}">' +
		'{{#if icon}}<img class="svg" alt="{{altText}}" src="{{icon}}" />{{/if}}' +
		'{{#if displayName}}<span> {{displayName}}</span>{{/if}}' +
		'</a>';

	/**
	 * Construct a new FileActions instance
	 * @constructs FileActions
	 * @memberof OCA.Files
	 */
	var FileActions = function() {
		this.initialize();
	};
	FileActions.TYPE_DROPDOWN = 0;
	FileActions.TYPE_INLINE = 1;
	FileActions.prototype = {
		/** @lends FileActions.prototype */
		actions: {},
		defaults: {},
		icons: {},

		/**
		 * @deprecated
		 */
		currentFile: null,

		/**
		 * Dummy jquery element, for events
		 */
		$el: null,

		/**
		 * List of handlers to be notified whenever a register() or
		 * setDefault() was called.
		 *
		 * @member {Function[]}
		 */
		_updateListeners: {},

		_fileActionTriggerTemplate: null,

		/**
		 * @private
		 */
		initialize: function() {
			this.clear();
			// abusing jquery for events until we get a real event lib
			this.$el = $('<div class="dummy-fileactions hidden"></div>');
			$('body').append(this.$el);

			this._showMenuClosure = _.bind(this._showMenu, this);
		},

		/**
		 * Adds an event handler
		 *
		 * @param {String} eventName event name
		 * @param {Function} callback
		 */
		on: function(eventName, callback) {
			this.$el.on(eventName, callback);
		},

		/**
		 * Removes an event handler
		 *
		 * @param {String} eventName event name
		 * @param Function callback
		 */
		off: function(eventName, callback) {
			this.$el.off(eventName, callback);
		},

		/**
		 * Notifies the event handlers
		 *
		 * @param {String} eventName event name
		 * @param {Object} data data
		 */
		_notifyUpdateListeners: function(eventName, data) {
			this.$el.trigger(new $.Event(eventName, data));
		},

		/**
		 * Merges the actions from the given fileActions into
		 * this instance.
		 *
		 * @param {OCA.Files.FileActions} fileActions instance of OCA.Files.FileActions
		 */
		merge: function(fileActions) {
			var self = this;
			// merge first level to avoid unintended overwriting
			_.each(fileActions.actions, function(sourceMimeData, mime) {
				var targetMimeData = self.actions[mime];
				if (!targetMimeData) {
					targetMimeData = {};
				}
				self.actions[mime] = _.extend(targetMimeData, sourceMimeData);
			});

			this.defaults = _.extend(this.defaults, fileActions.defaults);
			this.icons = _.extend(this.icons, fileActions.icons);
		},
		/**
		 * @deprecated use #registerAction() instead
		 */
		register: function(mime, name, permissions, icon, action, displayName) {
			return this.registerAction({
				name: name,
				mime: mime,
				permissions: permissions,
				icon: icon,
				actionHandler: action,
				displayName: displayName || name
			});
		},

		/**
		 * Register action
		 *
		 * @param {OCA.Files.FileAction} action object
		 */
		registerAction: function (action) {
			var mime = action.mime;
			var name = action.name;
			var actionSpec = {
				action: action.actionHandler,
				name: name,
				displayName: action.displayName,
				mime: mime,
				icon: action.icon,
				permissions: action.permissions,
				type: action.type || FileActions.TYPE_DROPDOWN
			};
			if (_.isUndefined(action.displayName)) {
				actionSpec.displayName = t('files', name);
			}
			if (_.isFunction(action.render)) {
				actionSpec.render = action.render;
			}
			if (!this.actions[mime]) {
				this.actions[mime] = {};
			}
			this.actions[mime][name] = actionSpec;
			this.icons[name] = action.icon;
			this._notifyUpdateListeners('registerAction', {action: action});
		},
		/**
		 * Clears all registered file actions.
		 */
		clear: function() {
			this.actions = {};
			this.defaults = {};
			this.icons = {};
			this.currentFile = null;
			this._updateListeners = [];
		},
		/**
		 * Sets the default action for a given mime type.
		 *
		 * @param {String} mime mime type
		 * @param {String} name action name
		 */
		setDefault: function (mime, name) {
			this.defaults[mime] = name;
			this._notifyUpdateListeners('setDefault', {defaultAction: {mime: mime, name: name}});
		},

		/**
		 * Returns a map of file actions handlers matching the given conditions
		 *
		 * @param {string} mime mime type
		 * @param {string} type "dir" or "file"
		 * @param {int} permissions permissions
		 *
		 * @return {Object.<string,OCA.Files.FileActions~actionHandler>} map of action name to action spec
		 */
		get: function (mime, type, permissions) {
			var actions = this.getActions(mime, type, permissions);
			var filteredActions = {};
			$.each(actions, function (name, action) {
				filteredActions[name] = action.action;
			});
			return filteredActions;
		},

		/**
		 * Returns an array of file actions matching the given conditions
		 *
		 * @param {string} mime mime type
		 * @param {string} type "dir" or "file"
		 * @param {int} permissions permissions
		 *
		 * @return {Array.<OCA.Files.FileAction>} array of action specs
		 */
		getActions: function (mime, type, permissions) {
			var actions = {};
			if (this.actions.all) {
				actions = $.extend(actions, this.actions.all);
			}
			if (type) {//type is 'dir' or 'file'
				if (this.actions[type]) {
					actions = $.extend(actions, this.actions[type]);
				}
			}
			if (mime) {
				var mimePart = mime.substr(0, mime.indexOf('/'));
				if (this.actions[mimePart]) {
					actions = $.extend(actions, this.actions[mimePart]);
				}
				if (this.actions[mime]) {
					actions = $.extend(actions, this.actions[mime]);
				}
			}
			var filteredActions = {};
			$.each(actions, function (name, action) {
				if (action.permissions & permissions) {
					filteredActions[name] = action;
				}
			});
			return filteredActions;
		},

		/**
		 * Returns the default file action handler for the given conditions
		 *
		 * @param {string} mime mime type
		 * @param {string} type "dir" or "file"
		 * @param {int} permissions permissions
		 *
		 * @return {OCA.Files.FileActions~actionHandler} action handler
		 *
		 * @deprecated use getDefaultFileAction instead
		 */
		getDefault: function (mime, type, permissions) {
			var defaultActionSpec = this.getDefaultFileAction(mime, type, permissions);
			if (defaultActionSpec) {
				return defaultActionSpec.action;
			}
			return undefined;
		},

		/**
		 * Returns the default file action handler for the given conditions
		 *
		 * @param {string} mime mime type
		 * @param {string} type "dir" or "file"
		 * @param {int} permissions permissions
		 *
		 * @return {OCA.Files.FileActions~actionHandler} action handler
		 * @since 8.2
		 */
		getDefaultFileAction: function(mime, type, permissions) {
			var mimePart;
			if (mime) {
				mimePart = mime.substr(0, mime.indexOf('/'));
			}
			var name = false;
			if (mime && this.defaults[mime]) {
				name = this.defaults[mime];
			} else if (mime && this.defaults[mimePart]) {
				name = this.defaults[mimePart];
			} else if (type && this.defaults[type]) {
				name = this.defaults[type];
			} else {
				name = this.defaults.all;
			}
			var actions = this.getActions(mime, type, permissions);
			return actions[name];
		},

		/**
		 * Default function to render actions
		 *
		 * @param {OCA.Files.FileAction} actionSpec file action spec
		 * @param {boolean} isDefault true if the action is a default one,
		 * false otherwise
		 * @param {OCA.Files.FileActionContext} context action context
		 */
		_defaultRenderAction: function(actionSpec, isDefault, context) {
			if (!isDefault) {
				var params = {
					name: actionSpec.name,
					nameLowerCase: actionSpec.name.toLowerCase(),
					displayName: actionSpec.displayName,
					icon: actionSpec.icon,
					altText: actionSpec.altText,
				};
				if (_.isFunction(actionSpec.icon)) {
					params.icon = actionSpec.icon(context.$file.attr('data-file'));
				}

				var $actionLink = this._makeActionLink(params, context);
				context.$file.find('a.name>span.fileactions').append($actionLink);
				$actionLink.addClass('permanent');
				return $actionLink;
			}
		},

		/**
		 * Renders the action link element
		 *
		 * @param {Object} params action params
		 */
		_makeActionLink: function(params) {
			if (!this._fileActionTriggerTemplate) {
				this._fileActionTriggerTemplate = Handlebars.compile(TEMPLATE_FILE_ACTION_TRIGGER);
			}

			return $(this._fileActionTriggerTemplate(params));
		},

		/**
		 * Displays the file actions dropdown menu
		 *
		 * @param {string} fileName file name
		 * @param {OCA.Files.FileActionContext} context rendering context
		 */
		_showMenu: function(fileName, context) {
			var menu;
			var $trigger = context.$file.closest('tr').find('.fileactions .action-menu');
			$trigger.addClass('open');

			menu = new OCA.Files.FileActionsMenu();

			context.$file.find('td.filename').append(menu.$el);

			menu.$el.on('afterHide', function() {
				context.$file.removeClass('mouseOver');
				$trigger.removeClass('open');
				menu.remove();
			});

			context.$file.addClass('mouseOver');
			menu.show(context);
		},

		/**
		 * Renders the menu trigger on the given file list row
		 * 
		 * @param {Object} $tr file list row element
		 * @param {OCA.Files.FileActionContext} context rendering context
		 */
		_renderMenuTrigger: function($tr, context) {
			// remove previous
			$tr.find('.action-menu').remove();

			var $el = this._renderInlineAction({
				name: 'menu',
				displayName: '',
				icon: OC.imagePath('core', 'actions/more'),
				altText: t('files', 'Actions'),
				action: this._showMenuClosure
			}, false, context);

			$el.addClass('permanent');
		},

		/**
		 * Renders the action element by calling actionSpec.render() and
		 * registers the click event to process the action.
		 *
		 * @param {OCA.Files.FileAction} actionSpec file action to render
		 * @param {boolean} isDefault true if the action is a default action,
		 * false otherwise
		 * @param {OCA.Files.FileActionContext} context rendering context
		 */
		_renderInlineAction: function(actionSpec, isDefault, context) {
			var renderFunc = actionSpec.render || _.bind(this._defaultRenderAction, this);
			var $actionEl = renderFunc(actionSpec, isDefault, context);
			if (!$actionEl || !$actionEl.length) {
				return;
			}
			$actionEl.on(
				'click', {
					a: null
				},
				function(event) {
					event.stopPropagation();
					event.preventDefault();

					if ($actionEl.hasClass('open')) {
						return;
					}

					var $file = $(event.target).closest('tr');
					if ($file.hasClass('busy')) {
						return;
					}
					var currentFile = $file.find('td.filename');
					var fileName = $file.attr('data-file');

					context.fileActions.currentFile = currentFile;
					// also set on global object for legacy apps
					window.FileActions.currentFile = currentFile;

					var callContext = _.extend({}, context);

					if (!context.dir && context.fileList) {
						callContext.dir = $file.attr('data-path') || context.fileList.getCurrentDirectory();
					}

					if (!context.fileInfoModel && context.fileList) {
						callContext.fileInfoModel = context.fileList.getModelForFile(fileName);
						if (!callContext.fileInfoModel) {
							console.warn('No file info model found for file "' + fileName + '"');
						}
					}

					actionSpec.action(
						fileName,
						callContext
					);
				}
			);
			return $actionEl;
		},

		/**
		 * Trigger the given action on the given file.
		 *
		 * @param {string} actionName action name
		 * @param {OCA.Files.FileInfoModel} fileInfoModel file info model
		 * @param {OCA.Files.FileList} [fileList] file list, for compatibility with older action handlers [DEPRECATED]
		 *
		 * @return {boolean} true if the action handler was called, false otherwise
		 *
		 * @since 8.2
		 */
		triggerAction: function(actionName, fileInfoModel, fileList) {
			var actionFunc;
			var actions = this.get(
				fileInfoModel.get('mimetype'),
				fileInfoModel.isDirectory() ? 'dir' : 'file',
				fileInfoModel.get('permissions')
			);

			if (actionName) {
				actionFunc = actions[actionName];
			} else {
				actionFunc = this.getDefault(
					fileInfoModel.get('mimetype'),
					fileInfoModel.isDirectory() ? 'dir' : 'file',
					fileInfoModel.get('permissions')
				);
			}

			if (!actionFunc) {
				actionFunc = actions['Download'];
			}

			if (!actionFunc) {
				return false;
			}

			var context = {
				fileActions: this,
				fileInfoModel: fileInfoModel,
				dir: fileInfoModel.get('path')
			};

			var fileName = fileInfoModel.get('name');
			this.currentFile = fileName;
			// also set on global object for legacy apps
			window.FileActions.currentFile = fileName;

			if (fileList) {
				// compatibility with action handlers that expect these
				context.fileList = fileList;
				context.$file = fileList.findFileEl(fileName);
			}

			actionFunc(fileName, context);
		},

		/**
		 * Display file actions for the given element
		 * @param parent "td" element of the file for which to display actions
		 * @param triggerEvent if true, triggers the fileActionsReady on the file
		 * list afterwards (false by default)
		 * @param fileList OCA.Files.FileList instance on which the action is
		 * done, defaults to OCA.Files.App.fileList
		 */
		display: function (parent, triggerEvent, fileList) {
			if (!fileList) {
				console.warn('FileActions.display() MUST be called with a OCA.Files.FileList instance');
				return;
			}
			this.currentFile = parent;
			var self = this;
			var $tr = parent.closest('tr');
			var actions = this.getActions(
				this.getCurrentMimeType(),
				this.getCurrentType(),
				this.getCurrentPermissions()
			);
			var nameLinks;
			if ($tr.data('renaming')) {
				return;
			}

			// recreate fileactions container
			nameLinks = parent.children('a.name');
			nameLinks.find('.fileactions, .nametext .action').remove();
			nameLinks.append('<span class="fileactions" />');
			var defaultAction = this.getDefaultFileAction(
				this.getCurrentMimeType(),
				this.getCurrentType(),
				this.getCurrentPermissions()
			);

			var context = {
				$file: $tr,
				fileActions: this,
				fileList: fileList
			};

			$.each(actions, function (name, actionSpec) {
				if (actionSpec.type === FileActions.TYPE_INLINE) {
					self._renderInlineAction(
						actionSpec,
						defaultAction && actionSpec.name === defaultAction.name,
						context
					);
				}
			});

			this._renderMenuTrigger($tr, context);

			if (triggerEvent){
				fileList.$fileList.trigger(jQuery.Event("fileActionsReady", {fileList: fileList, $files: $tr}));
			}
		},
		getCurrentFile: function () {
			return this.currentFile.parent().attr('data-file');
		},
		getCurrentMimeType: function () {
			return this.currentFile.parent().attr('data-mime');
		},
		getCurrentType: function () {
			return this.currentFile.parent().attr('data-type');
		},
		getCurrentPermissions: function () {
			return this.currentFile.parent().data('permissions');
		},

		/**
		 * Register the actions that are used by default for the files app.
		 */
		registerDefaultActions: function() {
			this.registerAction({
				name: 'Download',
				displayName: t('files', 'Download'),
				mime: 'all',
				permissions: OC.PERMISSION_READ,
				icon: function () {
					return OC.imagePath('core', 'actions/download');
				},
				actionHandler: function (filename, context) {
					var dir = context.dir || context.fileList.getCurrentDirectory();
					var url = context.fileList.getDownloadUrl(filename, dir);

					var downloadFileaction = $(context.$file).find('.fileactions .action-download');

					// don't allow a second click on the download action
					if(downloadFileaction.hasClass('disabled')) {
						return;
					}

					if (url) {
						var disableLoadingState = function() {
							context.fileList.showFileBusyState(filename, false);
						};

						context.fileList.showFileBusyState(downloadFileaction, true);
						OCA.Files.Files.handleDownload(url, disableLoadingState);
					}
				}
			});

			this.registerAction({
				name: 'Rename',
				mime: 'all',
				permissions: OC.PERMISSION_UPDATE,
				icon: function() {
					return OC.imagePath('core', 'actions/rename');
				},
				actionHandler: function (filename, context) {
					context.fileList.rename(filename);
				}
			});

			this.register('dir', 'Open', OC.PERMISSION_READ, '', function (filename, context) {
				var dir = context.$file.attr('data-path') || context.fileList.getCurrentDirectory();
				if (dir !== '/') {
					dir = dir + '/';
				}
				context.fileList.changeDirectory(dir + filename);
			});

			this.registerAction({
				name: 'Delete',
				mime: 'all',
				// permission is READ because we show a hint instead if there is no permission
				permissions: OC.PERMISSION_READ,
				icon: function() {
					return OC.imagePath('core', 'actions/delete');
				},
				actionHandler: function(fileName, context) {
					// if there is no permission to delete do nothing
					if((context.$file.data('permissions') & OC.PERMISSION_DELETE) === 0) {
						return;
					}
					context.fileList.do_delete(fileName, context.dir);
					$('.tipsy').remove();
				}
			});

			this.setDefault('dir', 'Open');
		}
	};

	OCA.Files.FileActions = FileActions;

	/**
	 * Replaces the download icon with a loading spinner and vice versa
	 * - also adds the class disabled to the passed in element
	 *
	 * @param downloadButtonElement download fileaction
	 * @param {boolean} showIt whether to show the spinner(true) or to hide it(false)
	 */
	OCA.Files.FileActions.updateFileActionSpinner = function(downloadButtonElement, showIt) {
		var icon = downloadButtonElement.find('img'),
			sourceImage = icon.attr('src');

		if(showIt) {
			downloadButtonElement.addClass('disabled');
			icon.attr('src', sourceImage.replace('actions/download.svg', 'loading-small.gif'));
		} else {
			downloadButtonElement.removeClass('disabled');
			icon.attr('src', sourceImage.replace('loading-small.gif', 'actions/download.svg'));
		}
	};

	/**
	 * File action attributes.
	 *
	 * @todo make this a real class in the future
	 * @typedef {Object} OCA.Files.FileAction
	 *
	 * @property {String} name identifier of the action
	 * @property {String} displayName display name of the action, defaults
	 * to the name given in name property
	 * @property {String} mime mime type
	 * @property {int} permissions permissions
	 * @property {(Function|String)} icon icon path to the icon or function
	 * that returns it
	 * @property {OCA.Files.FileActions~renderActionFunction} [render] optional rendering function
	 * @property {OCA.Files.FileActions~actionHandler} actionHandler action handler function
	 */

	/**
	 * File action context attributes.
	 *
	 * @typedef {Object} OCA.Files.FileActionContext
	 *
	 * @property {Object} $file jQuery file row element
	 * @property {OCA.Files.FileActions} fileActions file actions object
	 * @property {OCA.Files.FileList} fileList file list object
	 */

	/**
	 * Render function for actions.
	 * The function must render a link element somewhere in the DOM
	 * and return it. The function should NOT register the event handler
	 * as this will be done after the link was returned.
	 *
	 * @callback OCA.Files.FileActions~renderActionFunction
	 * @param {OCA.Files.FileAction} actionSpec action definition
	 * @param {Object} $row row container
	 * @param {boolean} isDefault true if the action is the default one,
	 * false otherwise
	 * @return {Object} jQuery link object
	 */

	/**
	 * Action handler function for file actions
	 *
	 * @callback OCA.Files.FileActions~actionHandler
	 * @param {String} fileName name of the file on which the action must be performed
	 * @param context context
	 * @param {String} context.dir directory of the file
	 * @param {OCA.Files.FileInfoModel} fileInfoModel file info model
	 * @param {Object} [context.$file] jQuery element of the file [DEPRECATED]
	 * @param {OCA.Files.FileList} [context.fileList] the FileList instance on which the action occurred [DEPRECATED]
	 * @param {OCA.Files.FileActions} context.fileActions the FileActions instance on which the action occurred
	 */

	// global file actions to be used by all lists
	OCA.Files.fileActions = new OCA.Files.FileActions();
	OCA.Files.legacyFileActions = new OCA.Files.FileActions();

	// for backward compatibility
	// 
	// legacy apps are expecting a stateful global FileActions object to register
	// their actions on. Since legacy apps are very likely to break with other
	// FileList views than the main one ("All files"), actions registered
	// through window.FileActions will be limited to the main file list.
	// @deprecated use OCA.Files.FileActions instead
	window.FileActions = OCA.Files.legacyFileActions;
	window.FileActions.register = function (mime, name, permissions, icon, action, displayName) {
		console.warn('FileActions.register() is deprecated, please use OCA.Files.fileActions.register() instead', arguments);
		OCA.Files.FileActions.prototype.register.call(
				window.FileActions, mime, name, permissions, icon, action, displayName
		);
	};
	window.FileActions.display = function (parent, triggerEvent, fileList) {
		fileList = fileList || OCA.Files.App.fileList;
		console.warn('FileActions.display() is deprecated, please use OCA.Files.fileActions.register() which automatically redisplays actions', mime, name);
		OCA.Files.FileActions.prototype.display.call(window.FileActions, parent, triggerEvent, fileList);
	};
})();


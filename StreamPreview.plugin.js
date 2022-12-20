/**
 * @name StreamPreview
 * @description Adds a button in the user context menu to open bigger stream preview image.
 * @author Vishnya
 * @authorId 282541644484575233
 * @version 1.0
 * @website https://github.com/Keenelge/BetterDiscordPlugins/blob/release/StreamPreview.plugin.js
 * @source https://raw.githubusercontent.com/Keenelge/BetterDiscordPlugins/release/StreamPreview.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Keenelge/BetterDiscordPlugins/release/StreamPreview.plugin.js
 */

const config = {
	info: {
		name: "StreamPreview",
		authors: [
			{
				name: "Vishnya",
				discord_id: "282541644484575233"
			},
			{
				name: "Marmota (Jaime Filho)",
				discord_id: "289112759948410881"
			},
		],
		version: "1.0",
		description: "Adds a button in the user context menu to open bigger stream preview image.",
	},
};

const buildPlugin = () => {
    const [Plugin, Api] = ZeresPluginLibrary.buildPlugin(config);

    const {ContextMenu} = window.BdApi;
	const {
		Logger,
		WebpackModules,
		DiscordModules: {
			React,
			ModalRoot,
			GuildStore,
			StreamStore,
			StreamPreviewStore,
			ModalActions,
		},
	} = Api;
	
	const ImageModal = WebpackModules.getModule(m => {
		const code = !m?.prototype ?
				""
			: !m?.prototype.render ?
				""
			: m?.prototype.render.toString()
			
		return code == "" ? undefined : code.includes("e.renderLinkComponent") && code.includes("e.shouldAnimate")
	});

	const ModalComponents = {
		Module: WebpackModules.getModule((m) =>
		[".renderModal,", "onCloseRequest"].every((s) =>
			Object.values(m).some((m) => m?.toString?.().includes(s))
		)
		),
		get Modal() {
			return Object.values(this.Module).find((m) =>
				m.toString().includes(".renderModal")
			);
		},
		get ModalCloseButton() {
			return Object.values(this.Module).find((m) =>
				m.toString().includes("closeWithCircle")
			);
		},
		get ModalContent() {
			return Object.values(this.Module).find((m) =>
				m.toString().includes(".content,")
			);
		},
		get ModalFooter() {
		return Object.values(this.Module).find((m) =>
				m.toString().includes(".footer,")
			);
		},
		get ModalHeader() {
			return Object.values(this.Module).find((m) =>
				m.toString().includes(".headerId")
			);
		},
		get ModalListContent() {
			return Object.values(this.Module).find((m) =>
				m.toString().includes(".scrollerRef")
			);
		},
		get ModalRoot() {
			return Object.values(this.Module).find((m) =>
				m.toString().includes(".transitionState", ".size")
			);
		},
		get ModalSize() {
			return Object.values(this.Module).find(
				(m) =>
				typeof m == "object" &&
				JSON.stringify(m).includes("DYNAMIC", "SMALL")
			);
		},
	};

	const Anchor = WebpackModules.getModule(m => ["anchorUnderlineOnHover", "noreferrer noopener"].every(s => m?.toString().includes(s)));

	return class StreamPreview extends Plugin {
		constructor() {
			super();
			this.contextMenuPatches = [];
		}

		checkZLibUpdate() {
			try {
				const library = BdApi.Plugins.get("ZeresPluginLibrary");
				if (library && (library.version.indexOf("2") !== 0)) {
					if (typeof (PluginUpdates) !== "undefined") PluginUpdates.checkAll();

					return BdApi.alert("Outdated Library", "Your ZeresPluginLibrary plugin is outdated. Please update it. https://betterdiscord.app/Download?id=9");
				}
			} catch (error) {
				Logger.warn("Failed to validate ZeresLib, you may run into issues.");
			}
		}

		onStart() {
			this.checkZLibUpdate()
			this.promises = {state: {cancelled: false}, cancel() {this.state.cancelled = true;}};
			this.patchUserContextMenus();
		}

		onStop() {
			this.promises.cancel();
			this.unbindContextMenus();
		}
		
		unbindContextMenus() {
			for (const cancel of this.contextMenuPatches) cancel();
		}
		
		patchUserContextMenus() {
			this.contextMenuPatches.push(ContextMenu.patch("user-context", (retVal, props) => {
				const guild = GuildStore.getGuild(props.guildId);
				if (!guild) return;

				const newItem = ContextMenu.buildItem({
					label: "View Stream Preview",
					action: () => {
						const stream = StreamStore.getStreamForUser(props.user.id);

						if (!stream) {
							return;
						}

						const previewURL = stream ?
							StreamPreviewStore.getPreviewURL(stream.guildId, stream.channelId, stream.ownerId) :
							null;

						if (!previewURL) {
							return;
						}
						
						this.openImageModal(previewURL)
					}
				});
				retVal?.props?.children[0]?.props?.children.splice(7, 0, newItem);
			}));
		}

		async fetchImage(url) {
			return new Promise((resolve, reject) => {
				const image = new Image();
				image.src = url;
	
				image.addEventListener('load', () => resolve(image));
				image.addEventListener('error', () => reject('Unable to fetch image.'));
			});
		}

		async openImageModal(url) {
			const image = await this.fetchImage(url);

			ModalActions.openModal((modalData) =>
				React.createElement(
					ModalRoot,
					Object.assign({}, modalData, {
						className: "modal-3Crloo",
						size: ModalComponents.ModalSize.DYNAMIC,
					}),
					React.createElement(ImageModal, {
						animated: false,
						src: url,
						original: url,
						width: image.width,
						height: image.height,
						className: "image-36HiZc",
						shouldAnimate: true,
						renderLinkComponent: (props) =>
							React.createElement(Anchor, props),
						children: null,
					})
				)
			);
		}

	}
}

module.exports = window.hasOwnProperty("ZeresPluginLibrary")
	? buildPlugin()
	: class {
		load() {
			BdApi.showConfirmationModal(
				"ZLib Missing",
				`The library plugin (ZeresPluginLibrary) needed for ${config.info.name} is missing. Please click Download Now to install it.`,
				{
					confirmText: "Download Now",
					cancelText: "Cancel",
					onConfirm: () => this.downloadZLib(),
				}
			);
		}
		async downloadZLib() {
			const fs = require("fs");
			const path = require("path");
			const ZLib = await fetch("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js");
			if (!ZLib.ok) return this.errorDownloadZLib();
			const ZLibContent = await ZLib.text();
			try {
				await fs.writeFile(
					path.join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"),
					ZLibContent,
					(err) => {
						if (err) return this.errorDownloadZLib();
					}
				);
			} catch (err) {
				return this.errorDownloadZLib();
			}
		}
		errorDownloadZLib() {
			const { shell } = require("electron");
			BdApi.showConfirmationModal(
				"Error Downloading",
				[
					`ZeresPluginLibrary download failed. Manually install plugin library from the link below.`,
				],
				{
					confirmText: "Download",
					cancelText: "Cancel",
					onConfirm: () => {
						shell.openExternal(
							"https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js"
						);
					},
				}
			);
		}
		start() {}
		stop() {}
	};
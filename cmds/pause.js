/**
 * Processes the "pause" command.
 * @param {import('../util/i18n.js')} lang - The user language.
 * @param {import('discord.js').Message} msg - The Discord message.
 * @param {String[]} args - The command arguments.
 * @param {String} line - The command as plain text.
 * @param {import('../util/wiki.js')} wiki - The wiki for the message.
 */
function cmd_pause(lang, msg, args, line, wiki) {
	if ( msg.channel.isGuild() && args.join(' ').split('\n')[0].isMention(msg.guild) && ( msg.isAdmin() || msg.isOwner() ) ) {
		if ( pause[msg.guildId] ) {
			delete pause[msg.guildId];
			console.log( '- Pause ended.' );
			msg.replyMsg( lang.get('pause.off'), true );
		} else {
			msg.replyMsg( lang.get('pause.on'), true );
			console.log( '- Pause started.' );
			pause[msg.guildId] = true;
		}
	} else if ( !msg.channel.isGuild() || !pause[msg.guildId] ) {
		this.LINK(lang, msg, line, wiki);
	}
}

module.exports = {
	name: 'pause',
	everyone: true,
	pause: true,
	owner: true,
	run: cmd_pause
};
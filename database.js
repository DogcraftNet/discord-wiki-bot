const {defaultSettings} = require('./util/default.json');
const {Client} = require('pg');
const db = new Client();
db.on( 'error', dberror => {
	console.log( '- Error while connecting to the database: ' + dberror );
} );

const schema = [`
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS patreons (
    patreon TEXT    PRIMARY KEY
                    UNIQUE
                    NOT NULL,
    count   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_patreons_patreon ON patreons (
    patreon
);

CREATE TABLE IF NOT EXISTS discord (
    main    TEXT    UNIQUE
                    CHECK (main = guild),
    guild   TEXT    NOT NULL
                    REFERENCES discord (main) ON DELETE CASCADE,
    channel TEXT,
    wiki    TEXT    NOT NULL
                    DEFAULT '${defaultSettings.wiki}',
    lang    TEXT    NOT NULL
                    DEFAULT '${defaultSettings.lang}',
    role    TEXT,
    inline  INTEGER,
    prefix  TEXT    NOT NULL
                    DEFAULT '${process.env.prefix}',
    patreon TEXT    REFERENCES patreons (patreon) ON DELETE SET NULL,
    voice   INTEGER,
    UNIQUE (
        guild,
        channel
    )
);

CREATE INDEX IF NOT EXISTS idx_discord_channel ON discord (
    guild,
    channel DESC
            NULLS LAST
);

CREATE INDEX IF NOT EXISTS idx_discord_patreon ON discord (
    patreon
)
WHERE patreon IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discord_voice ON discord (
    voice
)
WHERE voice IS NOT NULL;

CREATE TABLE IF NOT EXISTS verification (
    guild      TEXT    NOT NULL
                       REFERENCES discord (main) ON DELETE CASCADE,
    configid   INTEGER NOT NULL,
    channel    TEXT    NOT NULL,
    role       TEXT    NOT NULL,
    editcount  INTEGER NOT NULL
                       DEFAULT 0,
    postcount  INTEGER DEFAULT 0,
    usergroup  TEXT    NOT NULL
                       DEFAULT 'user',
    accountage INTEGER NOT NULL
                       DEFAULT 0,
    rename     INTEGER NOT NULL
                       DEFAULT 0,
    UNIQUE (
        guild,
        configid
    )
);

CREATE INDEX IF NOT EXISTS idx_verification_config ON verification (
    guild,
    configid ASC,
    channel
);

CREATE TABLE IF NOT EXISTS verifynotice (
    guild      TEXT    UNIQUE
                       NOT NULL
                       REFERENCES discord (main) ON DELETE CASCADE,
    logchannel TEXT,
    onsuccess  TEXT,
    onmatch    TEXT,
    flags      INTEGER NOT NULL
                       DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_verifynotice_guild ON verifynotice (
    guild
);

CREATE TABLE IF NOT EXISTS oauthusers (
    userid TEXT NOT NULL,
    site   TEXT NOT NULL,
    token  TEXT,
    UNIQUE (
        userid,
        site
    )
);

CREATE INDEX IF NOT EXISTS idx_oauthusers_userid ON oauthusers (
    userid,
    site
);

CREATE TABLE IF NOT EXISTS rcgcdw (
    guild    TEXT    NOT NULL
                     REFERENCES discord (main) ON DELETE CASCADE,
    configid INTEGER NOT NULL,
    webhook  TEXT    NOT NULL
                     UNIQUE,
    wiki     TEXT    NOT NULL,
    lang     TEXT    NOT NULL
                     DEFAULT '${defaultSettings.lang}',
    display  INTEGER NOT NULL
                     DEFAULT 1,
    rcid     INTEGER,
    postid   TEXT    DEFAULT '-1',
    UNIQUE (
        guild,
        configid
    )
);

CREATE INDEX IF NOT EXISTS idx_rcgcdw_wiki ON rcgcdw (
    wiki
);

CREATE INDEX IF NOT EXISTS idx_rcgcdw_webhook ON rcgcdw (
    webhook
);

CREATE INDEX IF NOT EXISTS idx_rcgcdw_config ON rcgcdw (
    guild,
    configid ASC
);

CREATE TABLE IF NOT EXISTS blocklist (
    wiki   TEXT UNIQUE
                NOT NULL,
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_blocklist_wiki ON blocklist (
    wiki
);

COMMIT TRANSACTION;
ALTER DATABASE "${process.env.PGDATABASE}" SET my.version TO 4;
`,`
BEGIN TRANSACTION;

    guild      TEXT    UNIQUE
                       NOT NULL
                       REFERENCES discord (main) ON DELETE CASCADE,
CREATE TABLE IF NOT EXISTS verifynotice (
    logchannel TEXT,
    onsuccess  TEXT,
    onmatch    TEXT
);

CREATE INDEX IF NOT EXISTS idx_verifynotice_guild ON verifynotice (
    guild
);

COMMIT TRANSACTION;
ALTER DATABASE "${process.env.PGDATABASE}" SET my.version TO 2;
`,`
BEGIN TRANSACTION;

ALTER TABLE verifynotice
ADD COLUMN IF NOT EXISTS flags INTEGER NOT NULL DEFAULT 0;

COMMIT TRANSACTION;
ALTER DATABASE "${process.env.PGDATABASE}" SET my.version TO 3;
`,`
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS oauthusers (
    userid TEXT NOT NULL,
    site   TEXT NOT NULL,
    token  TEXT,
    UNIQUE (
        userid,
        site
    )
);

CREATE INDEX IF NOT EXISTS idx_oauthusers_userid ON oauthusers (
    userid,
    site
);

COMMIT TRANSACTION;
ALTER DATABASE "${process.env.PGDATABASE}" SET my.version TO 4;
`];

module.exports = db.connect().then( () => {
	return db.query( 'SELECT CURRENT_SETTING($1) AS version', ['my.version'] ).then( ({rows:[row]}) => {
		row.version = parseInt(row.version, 10);
		if ( isNaN(row.version) || row.version > schema.length ) {
			console.log( '- Invalid database version: v' + row.version );
			return Promise.reject();
		}
		if ( row.version === schema.length ) {
			console.log( '- The database is up to date: v' + row.version );
			return;
		}
		console.log( '- The database is outdated: v' + row.version );
		if ( process.env.READONLY ) return Promise.reject();
		return db.query( schema.filter( (sql, version) => {
			if ( row.version === 0 ) return ( version === 0 );
			return ( row.version <= version );
		} ).join('\n') ).then( () => {
			console.log( '- The database has been updated to: v' + schema.length );
		}, dberror => {
			console.log( '- Error while updating the database: ' + dberror );
			return Promise.reject();
		} );
	}, dberror => {
		if ( dberror.message === 'unrecognized configuration parameter "my.version"' ) {
			return db.query( schema[0] ).then( () => {
				console.log( '- The database has been updated to: v' + schema.length );
			}, dberror => {
				console.log( '- Error while updating the database: ' + dberror );
				return Promise.reject();
			} );
		}
		console.log( '- Error while getting the database version: ' + dberror );
		return Promise.reject();
	} );
}, dberror => {
	console.log( '- Error while connecting to the database: ' + dberror );
	return Promise.reject();
} ).then( () => {
	db.end().catch( dberror => {
		console.log( '- Error while closing the database connection: ' + dberror );
	} );
}, () => {
	return db.end().then( () => {
		console.log( '- Closed the database connection.' );
	}, dberror => {
		console.log( '- Error while closing the database connection: ' + dberror );
	} ).then( () => {
		return Promise.reject();
	} );
} );

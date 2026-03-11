export type Language = 'en' | 'is' | 'no' | 'nl';

type TranslationValue = string | TranslationTree;
interface TranslationTree {
  [key: string]: TranslationValue;
}

const DEFAULT_LANGUAGE: Language = 'en';

export const translations: Record<Language, TranslationTree> = {
  en: {
    app: {
      title: 'Vegvisr Chat',
      badge: 'Early access'
    },
    chat: {
      groups: 'Groups',
      newGroup: 'New group',
      typeMessage: 'Type a message...',
      send: 'Send',
      noMessages: 'No messages yet. Say hello!',
      loadingMessages: 'Loading messages...',
      loadingOlder: 'Loading older...',
      today: 'Today',
      yesterday: 'Yesterday',
      signInPrompt: 'You are not signed in. Click "Sign in" to continue.',
      checkingSession: 'Checking session...',
      phoneSetup: 'Enter your phone number to start chatting',
      save: 'Save',
      aiMode: 'AI',
      selectGroup: 'Select a group to start chatting',
      deleteConfirm: 'Delete this message?',
      voiceRecord: 'Record voice message',
      attachMedia: 'Attach image or video',
      invite: 'Invite',
      members: 'Members',
      groupInfo: 'Group info',
    }
  },
  is: {
    app: {
      title: 'Vegvisr Spjall',
      badge: 'Snemma aðgangur'
    },
    chat: {
      groups: 'Hópar',
      newGroup: 'Nýr hópur',
      typeMessage: 'Skrifaðu skilaboð...',
      send: 'Senda',
      noMessages: 'Engin skilaboð ennþá. Segðu hæ!',
      loadingMessages: 'Hleð skilaboðum...',
      loadingOlder: 'Hleð eldri...',
      today: 'Í dag',
      yesterday: 'Í gær',
      signInPrompt: 'Þú ert ekki skráð/ur inn. Smelltu á "Skrá inn" til að halda áfram.',
      checkingSession: 'Athuga lotu...',
      phoneSetup: 'Sláðu inn símanúmerið þitt til að byrja að spjalla',
      save: 'Vista',
      aiMode: 'AI',
      selectGroup: 'Veldu hóp til að byrja að spjalla',
      voiceRecord: 'Taka upp raddskeyti',
      attachMedia: 'Hengja við mynd eða myndband',
      invite: 'Bjóða',
      members: 'Meðlimir',
      groupInfo: 'Hópupplýsingar',
    }
  },
  no: {
    app: {
      title: 'Vegvisr Chat',
      badge: 'Tidlig tilgang'
    },
    chat: {
      groups: 'Grupper',
      newGroup: 'Ny gruppe',
      typeMessage: 'Skriv en melding...',
      send: 'Send',
      noMessages: 'Ingen meldinger ennå. Si hei!',
      loadingMessages: 'Laster meldinger...',
      loadingOlder: 'Laster eldre...',
      today: 'I dag',
      yesterday: 'I går',
      signInPrompt: 'Du er ikke logget inn. Klikk "Logg inn" for å fortsette.',
      checkingSession: 'Sjekker sesjon...',
      phoneSetup: 'Skriv inn telefonnummeret ditt for å begynne å chatte',
      save: 'Lagre',
      aiMode: 'AI',
      selectGroup: 'Velg en gruppe for å starte en samtale',
      voiceRecord: 'Ta opp talemelding',
      attachMedia: 'Legg ved bilde eller video',
      invite: 'Inviter',
      members: 'Medlemmer',
      groupInfo: 'Gruppeinfo',
    }
  },
  nl: {
    app: {
      title: 'Vegvisr Chat',
      badge: 'Vroege toegang'
    },
    chat: {
      groups: 'Groepen',
      newGroup: 'Nieuwe groep',
      typeMessage: 'Typ een bericht...',
      send: 'Verzenden',
      noMessages: 'Nog geen berichten. Zeg hallo!',
      loadingMessages: 'Berichten laden...',
      loadingOlder: 'Oudere laden...',
      today: 'Vandaag',
      yesterday: 'Gisteren',
      signInPrompt: 'Je bent niet ingelogd. Klik op "Inloggen" om door te gaan.',
      checkingSession: 'Sessie controleren...',
      phoneSetup: 'Voer je telefoonnummer in om te beginnen met chatten',
      save: 'Opslaan',
      aiMode: 'AI',
      selectGroup: 'Selecteer een groep om te beginnen met chatten',
      voiceRecord: 'Spraakbericht opnemen',
      attachMedia: 'Afbeelding of video bijvoegen',
      invite: 'Uitnodigen',
      members: 'Leden',
      groupInfo: 'Groepsinformatie',
    }
  }
};

const walk = (tree: TranslationTree, parts: string[]): TranslationValue | undefined => {
  let current: TranslationValue = tree;
  for (const part of parts) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as TranslationTree)[part];
  }
  return current;
};

export const getTranslation = (language: Language, key: string) => {
  const parts = key.split('.');
  const langTree = translations[language] || translations[DEFAULT_LANGUAGE];
  const value = walk(langTree, parts);
  if (typeof value === 'string') {
    return value;
  }
  const fallbackValue = walk(translations[DEFAULT_LANGUAGE], parts);
  if (typeof fallbackValue === 'string') {
    return fallbackValue;
  }
  return key;
};

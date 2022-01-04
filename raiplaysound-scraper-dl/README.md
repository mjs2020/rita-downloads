# RaiPlayRadio-scraper-downloader

This is a simple node script designed to run on a synology NAS to automatically scrape raiplaysound.it for new episodes of configured programs and download them.

## Usage

1. Create the `config.json` file
2. Set the absolute path to it in `index.js`
3. Run with `node index.js`

## Deploy to diskstation

Run `npm run build` and copy `build/bundle.js` to the diskstation.

## Running as a cron task on a Synology DSM

The script was originally written to run automatically on a Synology Disk Station.
To get it running as a cron job I first installed NodeJS from the package center in
the disk station's web interface and then set up a cron job from Control Panel -> 
Task Scheduler. Node is located at /volume1/@appstore/Node.js/usr/bin/node so the job
had the following User-defined Script:

    /volume1/@appstore/Node.js/usr/bin/node /volume1/your/path/to/index.js

Or for another version of node that you've installed:
    
    /volume1/@appstore/Node.js_v12/usr/local/bin/node /volume1/your/path/to/index.js

## How it works

A hierarchy of pages:

* The rai play sound [website](https://www.raiplaysound.it/) has a list of podcast pages per channel such as [radio3](https://www.raiplaysound.it/radio3/podcast)
* The script takes as input via config a programme url such as: [Fahrenheit](https://www.raiplaysound.it/programmi/fahrenheit)
* Looks for subsections such as [2021 Il libro del giorno](https://www.raiplaysound.it/programmi/fahrenheit/puntata-/2021-il-libro-del-giorno-).
* For each, if any additional, subsection including the main page it scrapes the [episode link](https://www.raiplaysound.it/audio/2021/12/Fahrenheit-del-28122021-340fadbf-7bda-4358-8933-a4d803d1451c.html)

Getting the Mp3

* Replacing the episode link `.html` with `.json` you get a parsable representation with a `.downloadable_audio.url` param we can use.

Sample json response:

```json
{
  "page_updated": {
    "date": "28 Dicembre 2021",
    "hour": "18:09"
  },
  "uniquename": "ContentItem-340fadbf-7bda-4358-8933-a4d803d1451c",
  "type": "RaiPlaySound Audio Item",
  "create_date": "28-12-2021",
  "create_time": "18:05",
  "title": "Fahrenheit del 28/12/2021",
  "channel": {
    "name": "Rai Radio 3",
    "logo": "/dl/components/img/sound/loghi/logo-rairadio3-transparent.png",
    "category_path": "radio3",
    "palinsesto_url": "rai-radio-3",
    "palinsesto_name": "Radio 3"
  },
  "description": "Nella tradizione folclorica giapponese, il monte Fuji è sacro, molto amato e rispettato. Ci sono molte leggende e dicerie, una di questa recita: \"chi scala una volta nella vita il monte Fuji è saggio. Ma chi lo scala due volte è pazzo\". Kintaro, il famoso eroe della cultura nipponica, è impegnato nell'impresa più importante della sua giovane vita: raggiungere la cima del monte Fuji per raccogliere l'acqua miracolosa che sola può salvare la vita della madre, gravemente ammalata. Nella sua ascesa al monte è accompagnato dall'uccellino Honpo, già protagonista del precedente best seller Nippon Yokai, e dagli aiutanti Kuma, l'orso e Washi, l'aquila. ",
  "episode_title": "Elisa Menini, Nippon monogatari, Oblomov",
  "episode": null,
  "season": "2021",
  "form": "Integrale",
  "audio": {
    "title": "Fahrenheit del 28/12/2021",
    "poster": "/dl/img/2021/11/24/1637759714749_2048x2048%20fahrenheit.jpg",
    "url": "https://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=JgbYMQcBZLJynkvA5ssSlashtXvQeeqqEEqualeeqqEEqual",
    "type": "audio",
    "duration": "00:19:28"
  },
  "downloadable_audio": {
    "title": "Fahrenheit del 28/12/2021",
    "url": "http://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=2C8vr2pUXGjrPpswVCvjSgeeqqEEqualeeqqEEqual",
    "type": "downloadable_audio"
  },
  "images": {
    "square": "/dl/img/2021/11/24/1637759714749_2048x2048%20fahrenheit.jpg",
    "cover": null
  },
  "image": "/dl/img/2021/11/24/1637759714749_2048x2048%20fahrenheit.jpg",
  "program": {
    "id": "Category-aa79184c-8ca2-49ee-942e-817ac9514496",
    "name": "Fahrenheit",
    "pipe": "Fahrenheit|Category-aa79184c-8ca2-49ee-942e-817ac9514496",
    "category_path": "fahrenheit",
    "weblink": "/programmi/fahrenheit",
    "configuratore": "ContentItem-b60b5ede-a0ed-4929-a8a2-4cc1084a8bef",
    "contestual_page": "Page-3a8258ff-3cb3-4765-8335-8028550babe2",
    "path_id": "/programmi/fahrenheit.json"
  },
  "genres": [],
  "subgenres": [],
  "weblink": "/audio/2021/12/Fahrenheit-del-28122021-340fadbf-7bda-4358-8933-a4d803d1451c.html",
  "path_id": "/audio/2021/12/Fahrenheit-del-28122021-340fadbf-7bda-4358-8933-a4d803d1451c.json",
  "literal_publication_date": "28 Dic 2021",
  "literal_duration": "19 min",
  "adv": true,
  "noroll": false,
  "nofloorad": false,
  "dfp": {
    "escaped_name": "Fahrenheitdel28122021",
    "label": "cultr",
    "escaped_genres": [
      {
        "id": "Category-ada93711-8e1a-4181-adca-66d9e67d3caa",
        "name": "Librieletteratura"
      }
    ],
    "escaped_typology": [
      {
        "id": "Category-0aa7449f-a576-44ef-b6b3-1ff8e668f245",
        "name": "Programmiradio"
      }
    ]
  },
  "podcast_info": {
    "uniquename": "ContentItem-b60b5ede-a0ed-4929-a8a2-4cc1084a8bef",
    "type": "RaiPlaySound Programma Item",
    "create_date": "28-08-2017",
    "create_time": "17:18",
    "year": "2017",
    "date_tracking": "2017-08-28",
    "title": "Fahrenheit",
    "description": "Fahrenheit è il programma dedicato ai libri e alle idee. Un pomeriggio fatto di storie, di incontri e di eventi dai festival letterari. E dove trovano posto le parole degli scrittori e dei poeti, le scelte dei lettori, degli editori e dei gruppi di lettura. Il luogo dove si ritrovano gli amanti della letteratura, dalla tradizione dei classici alla narrativa contemporanea. Tutto questo è Fahrenheit.",
    "onair_date": "Dal lunedì al venerdì dalle 15.00 alle 18.00",
    "images": {
      "landscape": "/dl/img/2021/11/24/1637759670504_2048x1152%20fahrenheit.jpg",
      "square": "/dl/img/2021/11/24/1637759714749_2048x2048%20fahrenheit.jpg",
      "square_external": null
    },
    "image": "/dl/img/2021/11/24/1637759714749_2048x2048%20fahrenheit.jpg",
    "weblink": "/programmi/fahrenheit",
    "path_id": "/programmi/fahrenheit.json",
    "channel": {
      "name": "Rai Radio 3",
      "logo": "/dl/components/img/sound/loghi/logo-rairadio3-transparent.png",
      "category_path": "radio3",
      "palinsesto_url": "rai-radio-3",
      "palinsesto_name": "Radio 3"
    },
    "typology": "Programmi radio",
    "genres": [
      {
        "id": "Category-ada93711-8e1a-4181-adca-66d9e67d3caa",
        "name": "Libri e letteratura",
        "pipe": "Libri e letteratura|Category-ada93711-8e1a-4181-adca-66d9e67d3caa"
      }
    ],
    "subgenres": [
      {
        "id": "Category-e4b6f9a5-eb5a-43b2-b1ed-54ea7052adb5",
        "name": "Interviste",
        "pipe": "Interviste|Category-e4b6f9a5-eb5a-43b2-b1ed-54ea7052adb5"
      }
    ],
    "editor": "Rai Radio 3",
    "socials": [],
    "contacts": {
      "email": null,
      "phone_number": null,
      "sms": null,
      "whatsapp": null,
      "newsletter": null
    },
    "people": [
      {
        "image": "/dl/img/2017/11/09/1510239511138_LoredanaLipperini.jpg",
        "name": "Loredana Lipperini",
        "type": "RaiPlaySound Personaggio Item",
        "uniquename": "ContentItem-4ca652e9-297a-4b4c-bb84-2a009f1cfada",
        "role": "conduttore"
      },
      {
        "image": "/dl/img/2017/11/09/1510239583960_Tommaso%20Giartosio.JPG",
        "name": "Tommaso Giartosio",
        "type": "RaiPlaySound Personaggio Item",
        "uniquename": "ContentItem-5b2df494-9ab9-4d63-ae14-6b96bfb7245b",
        "role": "conduttore"
      },
      {
        "image": "/dl/img/2017/12/15/1513355106856_602468657_1280x720.jpg",
        "name": "Felice Cimatti",
        "type": "RaiPlaySound Personaggio Item",
        "uniquename": "ContentItem-b893810c-8a3d-4dba-b400-f29b3192c660",
        "role": "conduttore"
      },
      {
        "image": "/dl/img/2017/11/09/1510239680565_Graziano-Graziani.jpg",
        "name": "Graziano Graziani",
        "type": "RaiPlaySound Personaggio Item",
        "uniquename": "ContentItem-15319b0d-0407-45a3-b244-f5979aba418d",
        "role": "conduttore"
      },
      {
        "image": "/dl/img/2017/11/09/1510240002155_37143.jpg",
        "name": "Carlo D'Amicis",
        "type": "RaiPlaySound Personaggio Item",
        "uniquename": "ContentItem-dc65f593-f3f0-4193-b2b3-0f36a17f63f1",
        "role": "conduttore"
      },
      {
        "image": "/dl/img/2020/07/30/1596113926634_Enrico_Morteo.jpg",
        "name": "Enrico Morteo",
        "type": "RaiPlaySound Personaggio Item",
        "uniquename": "ContentItem-903aabc0-57bf-44c2-b332-1f70dbecd088",
        "role": "conduttore"
      }
    ],
    "metadata": {
      "product_sources": [
        {
          "id": "Category-4cbb5b4e-f80d-4017-9cc0-f3e7f5cb9437",
          "name": "Messa in onda Radio",
          "pipe": "Messa in onda Radio|Category-4cbb5b4e-f80d-4017-9cc0-f3e7f5cb9437",
          "principal": true
        }
      ],
      "targets": [],
      "school_levels": [],
      "languages": [],
      "audiodescription": []
    },
    "adv": true,
    "noroll": false,
    "nobanner": false,
    "nofloorad": false,
    "dfp": {
      "escaped_name": "Fahrenheit",
      "label": "cultr",
      "escaped_genres": [
        {
          "id": "Category-ada93711-8e1a-4181-adca-66d9e67d3caa",
          "name": "Librieletteratura"
        }
      ],
      "escaped_typology": [
        {
          "id": "Category-0aa7449f-a576-44ef-b6b3-1ff8e668f245",
          "name": "Programmiradio"
        }
      ]
    }
  },
  "set_path_id": "/programmi/fahrenheit/ContentSet-5fc6f145-d488-4aca-adf5-c0025fe5d9a7.json",
  "track_info": {
    "id": "ContentItem-340fadbf-7bda-4358-8933-a4d803d1451c",
    "domain": "raiplaysound",
    "platform": "[platform]",
    "media_type": "aod",
    "page_type": "audio",
    "editor": "rai radio 3",
    "section": "audio",
    "sub_section": "",
    "content": "pagina foglia",
    "title": "fahrenheit del 28/12/2021",
    "channel": "rai radio 3",
    "typology": "programmi radio",
    "genres": [
      "libri e letteratura"
    ],
    "sub_genres": [
      "interviste"
    ],
    "program_title": "fahrenheit",
    "program_typology": "programmi radio",
    "edition": "2021",
    "season": "2021",
    "episode_number": "",
    "episode_title": "elisa menini, nippon monogatari, oblomov",
    "form": "integrale",
    "media_name": "raiplaysound - aod - fahrenheit - elisa menini, nippon monogatari, oblomov - ContentItem-340fadbf-7bda-4358-8933-a4d803d1451c",
    "page_url": "/audio/2021/12/Fahrenheit-del-28122021-340fadbf-7bda-4358-8933-a4d803d1451c.html"
  }
}
```
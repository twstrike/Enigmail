FROM ubuntu

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y zip wget xvfb thunderbird gnupg2 make python gcc psmisc gnupg2
RUN wget -O /tmp/jsunit-0.1.xpi https://www.enigmail.net/jsunit/jsunit-0.1.xpi
RUN rm -rf /usr/lib/thunderbird-addons/extensions/jsunit@enigmail.net
RUN unzip /tmp/jsunit-0.1.xpi -d /usr/lib/thunderbird-addons/extensions/jsunit@enigmail.net
RUN rm -rf '/usr/lib/thunderbird-addons/extensions/{847b3a00-7ab1-11d4-8f02-006008948af5}'
RUN echo "/enigmail-src/build/dist" > '/usr/lib/thunderbird-addons/extensions/{847b3a00-7ab1-11d4-8f02-006008948af5}'
WORKDIR /enigmail-src

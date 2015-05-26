# enigmail-provisioning
Contains provisioning scripts for developing Enigmail, for Vagrant and Docker

If you have problems with permissions on the shared directory, this incantation is useful:
 chcon -Rt svirt_sandbox_file_t $DIR

## Quick Setup With Docker
Please follow your [OS specific instructions](https://docs.docker.com/installation/#installation) to install docker on your system.

Once docker is installed...

1. [Create a docker group.](https://docs.docker.com/installation/ubuntulinux/#create-a-docker-group) Creating this group will keep you from having to use sudo each time you call the docker client.
2. Start the docker daemon. Those platform specific instructions should be in the docker docs after the installation steps. If you created the docker user group in step one, this will be the only step that requires `sudo`.
3. `./provisioning/docker-init.sh`
4. `./provisioning/docker-build.sh`
5. `./provisioning/docker-test.sh`
